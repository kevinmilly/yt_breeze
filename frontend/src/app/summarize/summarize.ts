import { Component, signal, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { TermsDisclaimerComponent } from "../terms-disclaimer/terms-disclaimer";

@Component({
  selector: "app-summarize",
  standalone: true,
  imports: [FormsModule, CommonModule, TermsDisclaimerComponent],
  templateUrl: "./summarize.html",
  styleUrls: ["./summarize.css"]
})
export class Summarize {
  @ViewChild(TermsDisclaimerComponent) termsModal!: TermsDisclaimerComponent;

  // Make JSON available to template
  JSON = JSON;

  // UI-bound values
  youtubeUrlValue = "";
  userApiKeyValue = "";

  // Signals used in code
  youtubeUrl = signal("");
  userApiKey = signal("");

  loading = signal(false);
  error = signal("");
  result = signal<any | null>(null);
  debateMode = signal(false);
  // UI copy/save state
  lastCopied = signal<string | null>(null);

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
    navigator.clipboard.writeText(text).then(() => {
      // noop
    }).catch(() => {});
  }

  clearAll() {
    this.youtubeUrlValue = "";
    this.userApiKeyValue = "";
    this.youtubeUrl.set("");
    this.userApiKey.set("");
    this.result.set(null);
    this.error.set("");
  }

  copyWithFeedback(text: string, key: string) {
    this.copy(text);
    this.lastCopied.set(key);
    setTimeout(() => this.lastCopied.set(null), 1500);
  }

  copyAll() {
    const r = this.result();
    if (!r) return;
    const lines = [] as string[];
    lines.push("Title: " + (r.better_title || ""));
    lines.push("");
    lines.push("Bottom Line:");
    lines.push(r.bottom_line || "");
    lines.push("");
    lines.push("Key Points:");
    if (Array.isArray(r.key_points)) {
      r.key_points.forEach((p: string) => lines.push("- " + p));
    }
    const text = lines.join("\n");
    this.copyWithFeedback(text, "all");
  }

  save() {
    const r = this.result();
    if (!r) return;
    try {
      const stored = localStorage.getItem("yt_breeze_saved");
      const arr = stored ? JSON.parse(stored) : [];
      arr.unshift({
        url: this.youtubeUrlValue,
        title: r.better_title || null,
        result: r,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem("yt_breeze_saved", JSON.stringify(arr.slice(0, 50)));
      this.lastCopied.set("saved");
      setTimeout(() => this.lastCopied.set(null), 1200);
    } catch (e) {
      // ignore
    }
  }

  openTerms() {
    this.termsModal?.open();
  }
}
