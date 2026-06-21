import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroEmpleada } from './registro-empleada';

describe('RegistroEmpleada', () => {
  let component: RegistroEmpleada;
  let fixture: ComponentFixture<RegistroEmpleada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroEmpleada],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroEmpleada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
