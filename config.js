// Адрес функции в Supabase. У каждой копии бота своя функция: ?i=sauna в адресе приложения ведёт в функцию sauna,
// без параметра — в beauty. Для другого проекта замените llafvivdbtycuoqbwnbf на его Reference ID (Settings → General).
(function () {
  const instance = new URLSearchParams(location.search).get('i') || '';
  const name = /^[a-z][a-z0-9_]{1,20}$/.test(instance) ? instance : 'beauty';
  window.BEAUTY_API_URL = `https://llafvivdbtycuoqbwnbf.supabase.co/functions/v1/${name}/api`;
})();
