import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolicitudServicio } from './solicitud-servicio';

describe('SolicitudServicio', () => {
  let component: SolicitudServicio;
  let fixture: ComponentFixture<SolicitudServicio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudServicio],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudServicio);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
