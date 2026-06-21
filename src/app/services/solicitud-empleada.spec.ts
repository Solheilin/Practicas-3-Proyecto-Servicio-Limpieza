import { TestBed } from '@angular/core/testing';

import { SolicitudEmpleada } from './solicitud-empleada';

describe('SolicitudEmpleada', () => {
  let service: SolicitudEmpleada;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SolicitudEmpleada);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
