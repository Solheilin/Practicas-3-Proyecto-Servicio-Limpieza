import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Empleadas } from './empleadas';

describe('Empleadas', () => {
  let component: Empleadas;
  let fixture: ComponentFixture<Empleadas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Empleadas],
    }).compileComponents();

    fixture = TestBed.createComponent(Empleadas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
