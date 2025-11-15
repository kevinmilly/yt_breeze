import { Component, signal } from '@angular/core';
import { Summarize } from './summarize/summarize';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Summarize],
  template: `<app-summarize />`
})
export class App {
  protected readonly title = signal('frontend');
}
