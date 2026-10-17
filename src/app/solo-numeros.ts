import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

/**
 * DIRECTIVA PROPIA: solo deja escribir números en un <input>.
 *
 * Uso:
 *   <input appSoloNumeros>                       → solo números
 *   <input appSoloNumeros [maxDigitos]="10">     → solo números, máximo 10
 *
 * Borra al instante cualquier letra, espacio o símbolo, incluso si el usuario pega texto.
 * Funciona junto con [(ngModel)]: el modelo recibe el valor ya limpio.
 */
@Directive({
  selector: '[appSoloNumeros]',
})
export class SoloNumeros {

  /** Cantidad máxima de dígitos (opcional) */
  @Input() maxDigitos?: number;

  /** El <input> sobre el que se aplicó la directiva */
  private input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  /** Se ejecuta cada vez que cambia el texto del input (al escribir o pegar) */
  @HostListener('input')
  alEscribir() {
    let limpio = this.input.value.replace(/\D/g, '');   // \D = todo lo que NO es un número

    if (this.maxDigitos) {
      limpio = limpio.slice(0, this.maxDigitos);
    }

    if (limpio !== this.input.value) {
      this.input.value = limpio;
      // Avisamos del cambio para que ngModel tome el valor limpio
      this.input.dispatchEvent(new Event('input'));
    }
  }

  /** Bloquea las teclas que no son números (antes de que aparezcan) */
  @HostListener('keydown', ['$event'])
  alPresionarTecla(evento: KeyboardEvent) {
    const permitidas = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    const esAtajo = evento.ctrlKey || evento.metaKey;   // Ctrl+C, Ctrl+V, Ctrl+A, etc.

    if (permitidas.includes(evento.key) || esAtajo) return;

    if (!/^\d$/.test(evento.key)) {
      evento.preventDefault();
    }
  }
}