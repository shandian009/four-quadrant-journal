import type { CSSProperties } from 'react';
import type { ThemeId } from './resolve-theme';

export interface ThemeTokens {
  label: string;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  microAccent: string;
  border: string;
  danger: string;
  canvasGradient: string;
  sidebarGradient: string;
  surfaceGradient: string;
  calendarGradient: string;
  overviewGradient: string;
  reviewGradient: string;
  activeGradient: string;
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  monday: {
    label: '周一 · 冷启动',
    canvas: '#07111F', surface: '#102137', surfaceMuted: '#1B3048',
    text: '#F3F7FC', textMuted: '#9AAEC4', accent: '#2688FF',
    accentSoft: '#17375A', microAccent: '#43D6D1', border: '#2A4562', danger: '#FF6B61',
    canvasGradient: 'linear-gradient(135deg, #07111F 0%, #0D1B2E 100%)',
    sidebarGradient: 'linear-gradient(180deg, #0B1728 0%, #13233A 100%)',
    surfaceGradient: 'linear-gradient(145deg, #102137 0%, #162B45 100%)',
    calendarGradient: 'linear-gradient(145deg, #132137 0%, #1B2E4A 100%)',
    overviewGradient: 'linear-gradient(145deg, #0C2B36 0%, #12394A 100%)',
    reviewGradient: 'linear-gradient(110deg, #17243D 0%, #1A3151 100%)',
    activeGradient: 'linear-gradient(90deg, #174E91 0%, #1D78B5 100%)'
  },
  tuesday: {
    label: '周二 · 渐入状态',
    canvas: '#F5FAFF', surface: '#FFFFFF', surfaceMuted: '#E7F1FF',
    text: '#12254A', textMuted: '#617493', accent: '#2676E8',
    accentSoft: '#DDEBFF', microAccent: '#20B8C1', border: '#C9DDF4', danger: '#E95E55',
    canvasGradient: 'linear-gradient(135deg, #F5FAFF 0%, #DDEEFF 100%)',
    sidebarGradient: 'linear-gradient(180deg, #F8FBFF 0%, #E7F1FF 100%)',
    surfaceGradient: 'linear-gradient(145deg, #FFFFFF 0%, #F0F7FF 100%)',
    calendarGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EAF3FF 100%)',
    overviewGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EDF9F8 100%)',
    reviewGradient: 'linear-gradient(110deg, #FFFFFF 0%, #E8F2FF 100%)',
    activeGradient: 'linear-gradient(90deg, #D7E8FF 0%, #BFDDFB 100%)'
  },
  wednesday: {
    label: '周三 · 舒缓续航',
    canvas: '#F5FFFB', surface: '#FFFFFF', surfaceMuted: '#E4F6F0',
    text: '#173B34', textMuted: '#66847D', accent: '#20A77A',
    accentSoft: '#D9F2E8', microAccent: '#17AEC4', border: '#C7E6DC', danger: '#EB6659',
    canvasGradient: 'linear-gradient(135deg, #F5FFFB 0%, #DEF5EE 100%)',
    sidebarGradient: 'linear-gradient(180deg, #F7FFFC 0%, #E4F6F0 100%)',
    surfaceGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EEF9F5 100%)',
    calendarGradient: 'linear-gradient(145deg, #FFFFFF 0%, #F1FBF7 100%)',
    overviewGradient: 'linear-gradient(145deg, #FFFDF4 0%, #F0FAF5 100%)',
    reviewGradient: 'linear-gradient(110deg, #FFFFFF 0%, #E9F8F3 100%)',
    activeGradient: 'linear-gradient(90deg, #D7F1E7 0%, #BDE8DA 100%)'
  },
  thursday: {
    label: '周四 · 沉稳推进',
    canvas: '#071B17', surface: '#0E2C25', surfaceMuted: '#183E34',
    text: '#F1F8F5', textMuted: '#A1BEB5', accent: '#48D29B',
    accentSoft: '#173F34', microAccent: '#27B8C8', border: '#2F5A4D', danger: '#FF765F',
    canvasGradient: 'linear-gradient(135deg, #071B17 0%, #10362D 100%)',
    sidebarGradient: 'linear-gradient(180deg, #09221C 0%, #123B31 100%)',
    surfaceGradient: 'linear-gradient(145deg, #0E2C25 0%, #17463A 100%)',
    calendarGradient: 'linear-gradient(145deg, #102E28 0%, #173F37 100%)',
    overviewGradient: 'linear-gradient(145deg, #123228 0%, #1B4A3D 100%)',
    reviewGradient: 'linear-gradient(110deg, #10352C 0%, #175146 100%)',
    activeGradient: 'linear-gradient(90deg, #245E4D 0%, #317A64 100%)'
  },
  friday: {
    label: '周五 · 冲刺收官',
    canvas: '#101214', surface: '#1B1D20', surfaceMuted: '#292C2F',
    text: '#F5F4F1', textMuted: '#ACA8A1', accent: '#FF8A3D',
    accentSoft: '#3B2A20', microAccent: '#FFC44D', border: '#3B3D40', danger: '#FF6654',
    canvasGradient: 'linear-gradient(135deg, #101214 0%, #1A1D20 100%)',
    sidebarGradient: 'linear-gradient(180deg, #141618 0%, #202326 100%)',
    surfaceGradient: 'linear-gradient(145deg, #1B1D20 0%, #25282B 100%)',
    calendarGradient: 'linear-gradient(145deg, #191B1D 0%, #222426 100%)',
    overviewGradient: 'linear-gradient(145deg, #1A1B1C 0%, #28231E 100%)',
    reviewGradient: 'linear-gradient(110deg, #1D1E20 0%, #2A2825 100%)',
    activeGradient: 'linear-gradient(90deg, #3B3028 0%, #4B3B2F 100%)'
  },
  saturday: {
    label: '周六 · 松弛复盘',
    canvas: '#F3F9FD', surface: '#FFFFFF', surfaceMuted: '#E2F0F7',
    text: '#17384A', textMuted: '#6C8795', accent: '#2B8EAF',
    accentSoft: '#D9ECF5', microAccent: '#24B7AF', border: '#C4DBE7', danger: '#E66158',
    canvasGradient: 'linear-gradient(135deg, #F3F9FD 0%, #DCECF5 100%)',
    sidebarGradient: 'linear-gradient(180deg, #F4FAFD 0%, #E2F0F7 100%)',
    surfaceGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EAF4F9 100%)',
    calendarGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EDF6FA 100%)',
    overviewGradient: 'linear-gradient(145deg, #F8FDFF 0%, #E6F5F4 100%)',
    reviewGradient: 'linear-gradient(110deg, #FFFFFF 0%, #E4F1F7 100%)',
    activeGradient: 'linear-gradient(90deg, #D4EAF4 0%, #B8DDEB 100%)'
  }
};

export function themeStyle(themeId: ThemeId): CSSProperties {
  const theme = THEMES[themeId];
  return {
    '--canvas': theme.canvas,
    '--surface': theme.surface,
    '--surface-muted': theme.surfaceMuted,
    '--text': theme.text,
    '--text-muted': theme.textMuted,
    '--accent': theme.accent,
    '--accent-soft': theme.accentSoft,
    '--micro-accent': theme.microAccent,
    '--border': theme.border,
    '--danger': theme.danger,
    '--canvas-gradient': theme.canvasGradient,
    '--sidebar-gradient': theme.sidebarGradient,
    '--surface-gradient': theme.surfaceGradient,
    '--calendar-gradient': theme.calendarGradient,
    '--overview-gradient': theme.overviewGradient,
    '--review-gradient': theme.reviewGradient,
    '--active-gradient': theme.activeGradient
  } as CSSProperties;
}
