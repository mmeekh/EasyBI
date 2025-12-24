import React from 'react';

export const RotatingCoin = ({ size = 64 }: { size?: number }) => {
    return (
        <div className="relative group cursor-pointer" style={{ width: size, height: size, perspective: '1000px' }}>
            <style>
                {`
          @keyframes spinCoin {
            from { transform: rotateY(0deg); }
            to { transform: rotateY(360deg); }
          }
          .coin-container {
            width: 100%;
            height: 100%;
            position: relative;
            transform-style: preserve-3d;
            animation: spinCoin 6s linear infinite;
          }
          .coin-face {
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden; /* Safari support */
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .coin-face img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            pointer-events: none;
          }
          .coin-face-back {
            transform: rotateY(180deg);
          }
        `}
            </style>
            <div className="coin-container">
                {/* Front Face */}
                <div className="coin-face">
                    <img src="qq.png" alt="Logo" />
                </div>
                {/* Back Face */}
                <div className="coin-face coin-face-back">
                    <img src="qq.png" alt="Logo" />
                </div>
            </div>
        </div>
    );
};
