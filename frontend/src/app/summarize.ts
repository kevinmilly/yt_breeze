import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Injectable({ providedIn: "root" })
export class SummarizeService {
  private http = inject(HttpClient);

  summarize(body: any) {
    return this.http.post("/api/summarize", body);
  }
}
