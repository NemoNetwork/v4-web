import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import type { Nullable } from '@/constants/abacus';
import { SMALL_USD_DECIMALS, TOKEN_DECIMALS } from '@/constants/numbers';

import { getAppTheme } from '@/state/configsSelectors';

import type { RowData } from '@/views/Orderbook/OrderbookRow';

import { MustBigNumber } from '@/lib/numbers';

export const useDrawOrderbookHistograms = ({
  data,
  histogramRange,
  stepSizeDecimals,
  tickSizeDecimals,
  to = 'left',
  hoveredRow,
}: {
  data: RowData[];
  histogramRange: number;
  stepSizeDecimals: Nullable<number>;
  tickSizeDecimals: Nullable<number>;
  to?: 'left' | 'right';
  hoveredRow?: number;
}) => {
  const selectedTheme = useSelector(getAppTheme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas = canvasRef.current;

  /**
   *         to === 'right'                to === 'left'
   *         |===================|         |===================|
   * bar:    a                   b         c                   d
   * a = 0
   * b = depthBarWidth
   * c = canvasWidth - depthBarWidth
   * d = canvasWidth
   *
   */
  const getXYValues = ({
    barWidth,
    canvasWidth,
    gradientMultiplier,
  }: {
    barWidth: number;
    canvasWidth: number;
    gradientMultiplier: number;
  }) => {
    const gradient = {
      x1: to === 'right' ? barWidth : canvasWidth - barWidth,
      x2:
        to === 'right'
          ? 0 - (canvasWidth * gradientMultiplier - canvasWidth)
          : canvasWidth * gradientMultiplier,
    };
    const bar = {
      x1: to === 'right' ? 0 : canvasWidth - barWidth,
      x2: to === 'right' ? Math.min(barWidth, canvasWidth - 2) : canvasWidth - 2,
    };

    return {
      bar,
      gradient,
    };
  };

  const drawBars = ({
    value,
    canvasWidth,
    ctx,
    gradientMultiplier,
    histogramAccentColor,
    idx,
    to,
  }: {
    value: Nullable<number>;
    canvasWidth: number;
    ctx: CanvasRenderingContext2D;
    gradientMultiplier: number;
    histogramAccentColor: string;
    idx: number;
    to: 'left' | 'right';
  }) => {
    const histogramBarWidth = ctx.canvas.width - 2;
    const barWidth = value ? (value / histogramRange) * histogramBarWidth : 0;
    const { gradient, bar } = getXYValues({ barWidth, canvasWidth, gradientMultiplier });

    const linearGradient = ctx.createLinearGradient(gradient.x1, 10, gradient.x2, 10);
    linearGradient.addColorStop(0, histogramAccentColor);
    linearGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = linearGradient;

    ctx.beginPath();

    ctx.roundRect
      ? ctx.roundRect?.(
          bar.x1,
          idx * 20 + 1,
          bar.x2,
          18,
          to === 'left' ? [2, 0, 0, 2] : [0, 2, 2, 0]
        )
      : ctx.rect(bar.x1, idx * 20 + 1, bar.x2, 18);
    ctx.fill();
  };

  const drawText = ({
    ctx,
    idx,
    size,
    price,
    mine,
    x,
  }: {
    ctx: CanvasRenderingContext2D;
    idx: number;
    size?: Nullable<number>;
    price?: Nullable<number>;
    mine?: Nullable<number>;
    x: number;
  }) => {
    ctx.font = `12.5px Satoshi`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingQuality = 'high';

    // Size text
    if (size) {
      ctx.fillStyle = 'white';
      ctx.fillText(
        MustBigNumber(size).toFixed(stepSizeDecimals ?? TOKEN_DECIMALS),
        x - 8,
        idx * 20 + 10
      );
    }

    // Price text
    if (price) {
      ctx.fillStyle = 'white';
      ctx.fillText(
        MustBigNumber(price).toFixed(tickSizeDecimals ?? SMALL_USD_DECIMALS),
        x * 2 - 8,
        idx * 20 + 10
      );
    }

    // Mine text
    if (mine) {
      ctx.fillStyle = 'white';
      ctx.fillText(
        MustBigNumber(mine).toFixed(stepSizeDecimals ?? TOKEN_DECIMALS),
        x * 3 - 8,
        idx * 20 + 10
      );
    }
  };

  useEffect(() => {
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    const devicePixelRatio = window.devicePixelRatio || 1;

    const backingStoreRatio =
      // @ts-ignore
      ctx.webkitBackingStorePixelRatio ||
      // @ts-ignore
      ctx.mozBackingStorePixelRatio ||
      // @ts-ignore
      ctx.msBackingStorePixelRatio ||
      // @ts-ignore
      ctx.oBackingStorePixelRatio ||
      // @ts-ignore
      ctx.backingStorePixelRatio ||
      1;

    const ratio = devicePixelRatio / backingStoreRatio;

    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;

    // Scale the context
    ctx.scale(ratio, ratio);

    // Clear canvas before redraw
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const canvasWidth = canvas.width / ratio;
    const columnX = canvasWidth / 3;

    // Draw histograms
    data.forEach(({ depth, mine, price, size, side }, idx) => {
      const isHovered = hoveredRow === idx && size !== undefined;
      let histogramAlpha = 0.15;

      if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(0, idx * 20, canvasWidth, 20);
        histogramAlpha = 0.75;
      }

      const histogramAccentColor =
        side === 'bid'
          ? `hsla(159, 67%, 39%, ${histogramAlpha})`
          : `hsla(360, 73%, 61%, ${histogramAlpha})`;

      // Depth Bar
      drawBars({
        value: depth,
        canvasWidth,
        ctx,
        gradientMultiplier: 2,
        histogramAccentColor,
        idx,
        to,
      });

      // Size Bar
      drawBars({
        value: size,
        canvasWidth,
        ctx,
        gradientMultiplier: 5,
        histogramAccentColor,
        idx,
        to,
      });

      // Size, Price, Mine
      drawText({
        ctx,
        idx,
        size,
        price,
        mine,
        x: columnX,
      });
    });
  }, [data, histogramRange, hoveredRow, selectedTheme, stepSizeDecimals, tickSizeDecimals, to]);

  return { canvasRef };
};
