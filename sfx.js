async function playClick() {
  const audio = new Audio('assets/sound/down.ogg');
  await audio.play();
}
async function playIntro() {
  const audio = new Audio('assets/sound/launch.ogg');
  await audio.play();
}

export { playClick, playIntro };
