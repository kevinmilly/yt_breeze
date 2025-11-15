import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { Summarize } from "./app/summarize/summarize";

bootstrapApplication(Summarize, {
  providers: [provideHttpClient()]
});
