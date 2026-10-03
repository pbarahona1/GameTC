import { test, expect, type Page } from '@playwright/test';

/**
 * Recorrido completo de un jugador nuevo:
 * abrir la app → crear partida → conseguir empleo → avanzar el tiempo →
 * cerrar el primer mes → guardar → recargar → continuar.
 * Usa una semilla fija y los saltos de tiempo del menú (no el reloj real), así el
 * resultado es reproducible.
 */

const topDate = (page: Page) => page.locator('.topbar .date-block .d');

async function openMenuItem(page: Page, item: string) {
  await page.getByRole('button', { name: /^Más opciones/ }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${item}`) }).click();
}

async function bottomTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name }).click();
}

test('un jugador nuevo consigue empleo, cierra su primer mes y la partida sobrevive a recargar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1 · Abrir la app: primera partida.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Ultimate Realistic Tycoon/ })).toBeVisible();

  // 2 · Crear la partida (nombre, origen por defecto y semilla fija en opciones avanzadas).
  await page.getByLabel('Nombre').fill('Jugadora E2E');
  await page.getByText('Opciones avanzadas').click();
  await page.getByLabel('Semilla del mundo').fill('e2e-recorrido');
  await page.getByRole('button', { name: 'Comenzar partida' }).click();
  await expect(page.getByText('El tiempo está en pausa')).toBeVisible();
  await expect(topDate(page)).toHaveText(/1 ene 2026/);

  // 3 · Conseguir empleo: postularse a todas las vacantes posibles y avanzar de a una semana.
  await bottomTab(page, 'Carrera');
  await page.getByRole('tab', { name: 'Vacantes' }).click();
  const applyButtons = page.getByRole('button', { name: 'Postularme', exact: true });
  const available = await applyButtons.count();
  expect(available).toBeGreaterThan(0);
  for (let i = 0; i < available; i++) {
    const b = applyButtons.first();
    if (!(await b.isEnabled())) break;
    await b.click();
  }
  await expect(page.getByRole('button', { name: 'Postulado' }).first()).toBeVisible();

  // Las ofertas llegan a la pestaña «Empleo» (su etiqueta muestra cuántas hay).
  await page.getByRole('tab', { name: /^Empleo/ }).click();
  const accept = page.getByRole('button', { name: 'Aceptar', exact: true });
  for (let week = 0; week < 10 && !(await accept.isVisible()); week++) {
    // Un salto se detiene antes si llega una oferta (pausa automática por categoría «ofertas»).
    await openMenuItem(page, 'Avanzar 1 semana');
  }
  await expect(accept).toBeVisible();
  await accept.click();
  await page.getByRole('tab', { name: 'Vacantes' }).click();
  await expect(page.getByRole('button', { name: 'Tu puesto actual' })).toBeVisible();

  // 4 · Avanzar el tiempo hasta cerrar el primer mes.
  await openMenuItem(page, 'Avanzar 1 mes');
  await bottomTab(page, 'Inicio');
  await expect(topDate(page)).not.toHaveText(/ ene 2026/);
  // El gráfico de patrimonio aparece recién con el primer cierre de mes.
  await expect(page.getByRole('img', { name: /^Patrimonio neto/ })).toBeVisible();
  const dateBefore = (await topDate(page).textContent())!.trim();

  // 5 · Guardar desde Ajustes.
  await openMenuItem(page, 'Ajustes y guardado');
  await page.getByRole('button', { name: /Guardar/ }).first().click();
  await expect(page.getByText('Partida guardada.')).toBeVisible();

  // 6 · Recargar: la partida se abre donde quedó, con el empleo.
  await page.reload();
  await expect(topDate(page)).toHaveText(dateBefore);
  await bottomTab(page, 'Carrera');
  await page.getByRole('tab', { name: 'Vacantes' }).click();
  await expect(page.getByRole('button', { name: 'Tu puesto actual' })).toBeVisible();

  // 7 · Continuar jugando después de recargar.
  await openMenuItem(page, 'Avanzar 1 día');
  await expect(topDate(page)).not.toHaveText(dateBefore);

  expect(errors).toEqual([]);
});
