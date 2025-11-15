import { TestBed } from '@angular/core/testing';

import { Summarize } from './summarize';

describe('Summarize', () => {
  let service: Summarize;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Summarize);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
