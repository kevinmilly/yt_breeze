import { Component, signal, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SummarizeService } from "../summarize";

@Component({
  selector: "app-summarize",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./summarize.html",
  styleUrls: ["./summarize.css"],
})
export class Summarize {
  private svc = inject(SummarizeService);

  youtubeUrl = signal("");
  userApiKey = signal("");
  loading = signal(false);
  mode = signal("light");

  result = signal<any | null>(null);

  toggleMode() {
    this.mode.set(this.mode() === "light" ? "dark" : "light");
    document.body.className = this.mode();
  }

  submit() {
    this.loading.set(true);
    this.result.set(null);

    this.svc
      .summarize({
        youtubeUrl: this.youtubeUrl(),
        userApiKey: this.userApiKey(),
      })
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          alert(err.error?.error || "Error");
          this.loading.set(false);
        },
      });
  }

  copy(text: string) {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  }
}