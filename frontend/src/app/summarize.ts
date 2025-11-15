import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SummarizeService {
  private http = inject(HttpClient);

  summarize(payload: {
    transcript: string;
    title: string;
    userApiKey?: string;
  }) {
    return this.http.post('/api/summarize', payload);
  }
}
