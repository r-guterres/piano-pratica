// Aviso curto no rodapé ("Marco conquistado", "Plano atualizado"…).

export const toast = $state({ text: '' });
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, ms = 3500): void {
  toast.text = text;
  clearTimeout(timer);
  timer = setTimeout(() => (toast.text = ''), ms);
}
