import io
import uuid
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="EasyBI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

_DATASETS: Dict[str, pd.DataFrame] = {}


def _detect_file_type(filename: str) -> str:
    if filename.lower().endswith(".csv"):
        return "csv"
    if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
        return "excel"
    raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")


def _serialize_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, pd.Timedelta)):
        return value.isoformat()
    return value


def _map_dtype(dtype: pd.api.types.CategoricalDtype | pd.Series | Any) -> str:
    if pd.api.types.is_numeric_dtype(dtype):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"
    return "categorical"


def _build_preview(df: pd.DataFrame, limit: int = 20) -> List[Dict[str, Any]]:
    preview_df = df.head(limit).fillna(value=pd.NA)
    return [
        {column: _serialize_value(row[column]) for column in preview_df.columns}
        for _, row in preview_df.iterrows()
    ]


def _detect_columns(df: pd.DataFrame) -> List[Dict[str, str]]:
    columns = []
    for column in df.columns:
        dtype = _map_dtype(df[column].dtype)
        columns.append({"name": str(column), "dtype": dtype})
    return columns


class ColumnInfo(BaseModel):
    name: str
    dtype: str


class SuggestChartsRequest(BaseModel):
    columns: List[ColumnInfo]


class SuggestChartsResponse(BaseModel):
    suggestions: List[str]


class GenerateChartRequest(BaseModel):
    datasetId: str = Field(..., alias="datasetId")
    chartType: str
    xAxis: Optional[str] = None
    yAxis: Optional[str] = None
    aggregation: Optional[str] = None

    class Config:
        allow_population_by_field_name = True


@app.post("/upload-excel")
def upload_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    try:
        file_type = _detect_file_type(file.filename)
        data = file.file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        buffer = io.BytesIO(data)
        if file_type == "csv":
            df = pd.read_csv(buffer)
        else:
            df = pd.read_excel(buffer)

        if df.empty:
            raise HTTPException(status_code=400, detail="No data detected in the file.")

        dataset_id = str(uuid.uuid4())
        _DATASETS[dataset_id] = df

        columns = _detect_columns(df)
        preview = _build_preview(df)

        return {
            "datasetId": dataset_id,
            "columns": columns,
            "preview": preview,
            "rowCount": int(len(df)),
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - protective catch
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}") from exc


@app.post("/suggest-charts", response_model=SuggestChartsResponse)
def suggest_charts(request: SuggestChartsRequest) -> SuggestChartsResponse:
    numeric_columns = [col for col in request.columns if col.dtype == "numeric"]
    datetime_columns = [col for col in request.columns if col.dtype == "datetime"]
    categorical_columns = [col for col in request.columns if col.dtype == "categorical"]

    suggestions: List[str] = []

    if numeric_columns:
        suggestions.append("bar")
        suggestions.append("line")
        suggestions.append("kpi")

    if numeric_columns and categorical_columns:
        if "bar" not in suggestions:
            suggestions.append("bar")

    if numeric_columns and datetime_columns and "line" not in suggestions:
        suggestions.append("line")

    if categorical_columns and len(categorical_columns) <= 6 and numeric_columns:
        suggestions.append("pie")

    if not suggestions:
        suggestions = ["bar"]

    # Remove duplicates while preserving order
    seen = set()
    unique_suggestions = []
    for suggestion in suggestions:
        if suggestion not in seen:
            unique_suggestions.append(suggestion)
            seen.add(suggestion)

    return SuggestChartsResponse(suggestions=unique_suggestions)


@app.post("/generate-chart")
def generate_chart(request: GenerateChartRequest) -> Dict[str, Any]:
    dataset_id = request.datasetId
    if dataset_id not in _DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found. Upload data first.")

    df = _DATASETS[dataset_id]
    chart_type = request.chartType.lower()

    if chart_type not in {"bar", "line", "pie", "kpi"}:
        raise HTTPException(status_code=400, detail="Unsupported chart type.")

    data: List[Dict[str, Any]]
    layout: Dict[str, Any] = {"title": chart_type.upper()}

    if chart_type == "kpi":
        if not request.yAxis:
            raise HTTPException(status_code=400, detail="yAxis is required for KPI charts.")
        if request.yAxis not in df.columns:
            raise HTTPException(status_code=400, detail="Selected yAxis column not found in dataset.")

        value = df[request.yAxis]
        agg = (request.aggregation or "sum").lower()
        if agg == "sum":
            kpi_value = value.sum()
        elif agg == "avg" or agg == "mean":
            kpi_value = value.mean()
        elif agg == "max":
            kpi_value = value.max()
        elif agg == "min":
            kpi_value = value.min()
        else:
            raise HTTPException(status_code=400, detail="Unsupported aggregation for KPI chart.")

        layout.update({
            "title": f"KPI - {request.yAxis} ({agg.upper()})",
            "annotations": [
                {
                    "text": f"{kpi_value:,.2f}",
                    "showarrow": False,
                    "font": {"size": 48},
                    "xref": "paper",
                    "yref": "paper",
                    "x": 0.5,
                    "y": 0.5,
                }
            ],
            "xaxis": {"visible": False},
            "yaxis": {"visible": False},
        })
        data = []
        return {"data": data, "layout": layout}

    if not request.xAxis or not request.yAxis:
        raise HTTPException(status_code=400, detail="xAxis and yAxis are required for this chart type.")

    if request.xAxis not in df.columns or request.yAxis not in df.columns:
        raise HTTPException(status_code=400, detail="Selected columns not found in dataset.")

    x_series = df[request.xAxis]
    y_series = df[request.yAxis]

    if request.aggregation:
        agg = request.aggregation.lower()
        grouped = df.groupby(request.xAxis)[request.yAxis]
        if agg == "sum":
            aggregated = grouped.sum()
        elif agg in {"mean", "avg"}:
            aggregated = grouped.mean()
        elif agg == "max":
            aggregated = grouped.max()
        elif agg == "min":
            aggregated = grouped.min()
        elif agg == "count":
            aggregated = grouped.count()
        else:
            raise HTTPException(status_code=400, detail="Unsupported aggregation function.")
        x_values = aggregated.index.tolist()
        y_values = aggregated.values.tolist()
    else:
        x_values = x_series.tolist()
        y_values = y_series.tolist()

    if chart_type == "pie":
        data = [
            {
                "type": "pie",
                "labels": x_values,
                "values": y_values,
                "hole": 0,
            }
        ]
        layout.update({"title": f"Pie Chart of {request.yAxis} by {request.xAxis}"})
    else:
        trace_type = "bar" if chart_type == "bar" else "scatter"
        trace_mode = "lines" if chart_type == "line" else None
        trace: Dict[str, Any] = {
            "type": trace_type,
            "x": x_values,
            "y": y_values,
            "name": request.yAxis,
        }
        if trace_mode:
            trace["mode"] = trace_mode
        data = [trace]
        layout.update({
            "title": f"{chart_type.title()} Chart of {request.yAxis} vs {request.xAxis}",
            "xaxis": {"title": request.xAxis},
            "yaxis": {"title": request.yAxis},
        })

    return {"data": data, "layout": layout}


@app.get("/")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5050)
