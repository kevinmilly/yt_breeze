// frontend/src/app/summarize.ts (or wherever yours is)
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SummarizeService {
  private http = inject(HttpClient);
  private apiUrl = '/api/summarize';

  summarize(payload: { youtubeUrl: string; userApiKey?: string }) {
    return this.http.post<any>(this.apiUrl, payload);
  }
}
