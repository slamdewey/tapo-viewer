import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./camera-viewer/camera-viewer').then((m) => m.CameraViewer),
  },
  {
    path: 'cam/:id',
    loadComponent: () =>
      import('./camera-viewer/camera-viewer').then((m) => m.CameraViewer),
  },
  {
    path: 'cameras',
    loadComponent: () =>
      import('./camera-list/camera-list').then((m) => m.CameraList),
  },
  { path: '**', redirectTo: '' },
];
