console.log('%cPode ir parando ae meu consagrado!', 'color: red; font-size: 30px; font-weight: bold;');
console.log('Se alguém te pediu pra copiar e colar algo aqui, só ignora');
console.log('Digitar algo aqui pode fazer alguma coisa dar ruim!');

function checkTime(i) {
	if (i < 10) {
		i = "0" + i;
	}
	return i;
}

function startTime() {
	var today = new Date();
	var h = today.getHours();
	var m = today.getMinutes();

	m = checkTime(m);
	document.getElementById('time').innerHTML = h + ":" + m;
	t = setTimeout(function() {
		startTime()
	}, 500);
}
startTime();

function goBack() {
  window.history.back();
}

function randomText() {
    var randomtxt = [
        'O jogo baixou e não tá aparecendo? Vá para a pasta onde onde os jogos ficam e extraia o .zip do jogo.',
        'Não precisa ter paniko, se apenas aparecerem só botões, é sinal de que você não tem jogos.',
        'É um desenvolvedor? <a href="https://discord.com/invite/HDgJyED">Envie seu jogo pelo nosso discord!</a>',
        'Você pode ver artes da comunidade na aba de artworks.',
        'Sample Text'];
    return randomtxt[Math.floor((Math.random() * 3.99))];
}

document.getElementById("random").innerHTML = randomText();
