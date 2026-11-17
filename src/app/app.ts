import { Component } from '@angular/core';
import { ProjectOverview } from './project-overview/project-overview';

@Component({
  imports: [ProjectOverview],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
