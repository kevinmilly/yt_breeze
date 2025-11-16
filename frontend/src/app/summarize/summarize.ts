import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-summarize",
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: "./summarize.html",
  styleUrls: ["./summarize.css"]
})
export class Summarize {
  // UI-bound values
  youtubeUrlValue = "";
  userApiKeyValue = "";

  // Signals used in code
  youtubeUrl = signal("");
  userApiKey = signal("");

  loading = signal(false);
  error = signal("");
  result = signal<any | null>(null);

  onYoutubeUrlChange(v: string) {
    this.youtubeUrlValue = v;
    this.youtubeUrl.set(v);
  }

  onUserApiKeyChange(v: string) {
    this.userApiKeyValue = v;
    this.userApiKey.set(v);
  }

  async summarize() {
    this.error.set("");
    this.result.set(null);
    this.loading.set(true);

    try {
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: this.youtubeUrl(),
          userApiKey: this.userApiKey(),
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        this.error.set(json.error || "Unknown error");
      } else {
        this.result.set(json);
      }
    } catch (err: any) {
      this.error.set(err?.message || "Network error");
    } finally {
      this.loading.set(false);
    }
  }

  copy(text: string) {
    navigator.clipboard.writeText(text);
  }
}
