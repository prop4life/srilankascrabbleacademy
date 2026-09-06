const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');

menuButton.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

document.querySelectorAll('[data-modal]').forEach((trigger) => {
  trigger.addEventListener('click', () => document.getElementById(trigger.dataset.modal).showModal());
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const details = new FormData(form);
    const lines = [`Hello SLSA, ${form.dataset.success}`, ''];
    for (const [key, value] of details.entries()) {
      if (value) lines.push(`${key[0].toUpperCase()}${key.slice(1)}: ${value}`);
    }
    window.open(`https://wa.me/94702131042?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    form.closest('dialog').close();
    form.reset();
  });
});
