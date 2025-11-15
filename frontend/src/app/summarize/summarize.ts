import { Component, signal, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummarizeService } from '../summarize';

@Component({
  selector: 'app-summarize',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './summarize.html',
  styleUrls: ['./summarize.css']
})
export class Summarize {
  private summarizeService = inject(SummarizeService);

  title = signal('');
  transcript = signal('');
  userApiKey = signal('');
  loading = signal(false);
  result = signal<any | null>(null);

  submit() {
    this.loading.set(true);

    this.summarizeService.summarize({
      title: this.title(),
      transcript: this.transcript(),
      userApiKey: this.userApiKey() || undefined
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        alert(err.error?.error || 'Error');
        this.loading.set(false);
      }
    });
  }
}
