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

  youtubeUrl = signal('');
  userApiKey = signal('');
  loading = signal(false);
  result = signal<any | null>(null);

  darkMode = signal(false);
  copyStatus = signal<'idle' | 'success' | 'error'>('idle');

  toggleDarkMode() {
    this.darkMode.update(v => !v);
  }

  submit() {
    if (!this.youtubeUrl()) {
      alert('Please enter a YouTube URL.');
      return;
    }

    this.loading.set(true);
    this.copyStatus.set('idle');

    this.summarizeService
      .summarize({
        youtubeUrl: this.youtubeUrl(),
        userApiKey: this.userApiKey() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          alert(err.error?.error || 'Error processing video');
          this.loading.set(false);
        },
      });
  }

  async copySummary() {
    const r = this.result();
    if (!r) return;

    const text = this.buildSummaryText(r);

    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus.set('success');
      setTimeout(() => this.copyStatus.set('idle'), 2000);
    } catch (e) {
      console.error(e);
      this.copyStatus.set('error');
      setTimeout(() => this.copyStatus.set('idle'), 2000);
    }
  }

  private buildSummaryText(r: any): string {
    const lines: string[] = [];

    lines.push(`Bottom Line: ${r.bottom_line}`);
    lines.push('');
    if (r.key_points?.length) {
      lines.push('Key Points:');
      r.key_points.forEach((kp: string, i: number) => {
        lines.push(`${i + 1}. ${kp}`);
      });
      lines.push('');
    }
    if (r.skip_to_timestamp) {
      lines.push(`Skip to: ${r.skip_to_timestamp}`);
      lines.push('');
    }
    if (r.fluff_level) {
      lines.push(
        `Fluff Level: ${r.fluff_level.score}/100 - ${r.fluff_level.summary}`,
      );
      lines.push('');
    }
    if (r.clickbait_accuracy) {
      lines.push(
        `Clickbait Accuracy: ${r.clickbait_accuracy.score}/100 - ${r.clickbait_accuracy.explanation}`,
      );
      lines.push('');
    }
    if (r.better_title) {
      lines.push(`Better Title Suggestion: ${r.better_title}`);
    }

    return lines.join('\n');
  }
}
