import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Summarize } from './summarize';

describe('Summarize', () => {
  let component: Summarize;
  let fixture: ComponentFixture<Summarize>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Summarize]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Summarize);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
