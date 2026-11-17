import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

interface Project {
  _id: string;
  code: string;
  name: string;
  lead: string;
  startDate: string;
  dueDate: string;
  status: string;
  description: string;
}

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-project-overview',
  styleUrl: './project-overview.css',
  templateUrl: './project-overview.html',
})
export class ProjectOverview implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly api = 'http://localhost:8000/api/projects';

  readonly statuses = ['On Track', 'At Risk', 'Blocked', 'Completed'];
  readonly form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    lead: ['', Validators.required],
    startDate: ['', Validators.required],
    dueDate: ['', Validators.required],
    status: ['On Track', Validators.required],
    description: ['', Validators.required],
  });

  projects: Project[] = [];
  selected: Project | null = null;
  editingId: string | null = null;
  busy = false;
  message = '';

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.http.get<Project[]>(this.api).subscribe({
      next: projects => this.projects = projects,
      error: () => this.message = 'Could not load projects. Check Express and MongoDB.',
    });
  }

  view(id: string): void {
    this.selected = null;
    this.message = '';
    this.http.get<Project>(`${this.api}/${id}`).subscribe({
      next: project => this.selected = project,
      error: () => this.message = 'Could not load this project.',
    });
  }

  edit(project: Project): void {
    this.editingId = project._id;
    this.form.patchValue(project);
    this.message = '';
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form.reset();
  }

  save(): void {
    if (this.busy) return;

    const values = this.form.getRawValue();
    if (this.form.invalid || Object.values(values).some(value => !value.trim())) {
      this.message = 'Complete all seven fields.';
      return;
    }
    if (values.dueDate < values.startDate) {
      this.message = 'The due date must be on or after the start date.';
      return;
    }

    const id = this.editingId;
    const request = id
      ? this.http.put<Project>(`${this.api}/${id}`, values)
      : this.http.post<Project>(this.api, values);

    this.busy = true;
    this.message = '';
    request.subscribe({
      next: project => {
        if (this.selected?._id === project._id) this.selected = project;
        this.cancelEdit();
        this.busy = false;
        this.message = id ? 'Project updated.' : 'Project created.';
        this.loadProjects();
      },
      error: () => {
        this.busy = false;
        this.message = 'Could not save the project. Check the fields and server.';
      },
    });
  }

  remove(project: Project): void {
    if (this.busy || !window.confirm(`Delete "${project.name}"?`)) return;

    this.busy = true;
    this.message = '';
    this.http.delete<void>(`${this.api}/${project._id}`).subscribe({
      next: () => {
        if (this.selected?._id === project._id) this.selected = null;
        if (this.editingId === project._id) this.cancelEdit();
        this.busy = false;
        this.message = 'Project deleted.';
        this.loadProjects();
      },
      error: () => {
        this.busy = false;
        this.message = 'Could not delete the project.';
      },
    });
  }
}
