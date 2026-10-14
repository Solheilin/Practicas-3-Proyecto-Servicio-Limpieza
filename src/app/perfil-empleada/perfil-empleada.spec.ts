import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PerfilEmpleada } from './perfil-empleada';

describe('PerfilEmpleada', () => {
  let component: PerfilEmpleada;
  let fixture: ComponentFixture<PerfilEmpleada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilEmpleada],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilEmpleada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
