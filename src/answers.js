// The twenty classic Magic 8 Ball responses, plus a handful of
// pumpkin-flavoured ones. `tone` drives the glow colour of the reveal.
export const ANSWERS = [
  { text: 'It is certain.', tone: 'positive' },
  { text: 'It is decidedly so.', tone: 'positive' },
  { text: 'Without a doubt.', tone: 'positive' },
  { text: 'Yes, definitely.', tone: 'positive' },
  { text: 'You may rely on it.', tone: 'positive' },
  { text: 'As I see it, yes.', tone: 'positive' },
  { text: 'Most likely.', tone: 'positive' },
  { text: 'Outlook good.', tone: 'positive' },
  { text: 'Yes.', tone: 'positive' },
  { text: 'Signs point to yes.', tone: 'positive' },
  { text: 'The spirits say yes.', tone: 'positive' },

  { text: 'Reply hazy, try again.', tone: 'neutral' },
  { text: 'Ask again later.', tone: 'neutral' },
  { text: 'Better not tell you now.', tone: 'neutral' },
  { text: 'Cannot predict now.', tone: 'neutral' },
  { text: 'Concentrate and ask again.', tone: 'neutral' },
  { text: 'Ask again by moonlight.', tone: 'neutral' },

  { text: "Don't count on it.", tone: 'negative' },
  { text: 'My reply is no.', tone: 'negative' },
  { text: 'My sources say no.', tone: 'negative' },
  { text: 'Outlook not so good.', tone: 'negative' },
  { text: 'Very doubtful.', tone: 'negative' },
  { text: 'The candle flickers… no.', tone: 'negative' },
];

let lastIndex = -1;

export function pickAnswer() {
  let i;
  do {
    i = Math.floor(Math.random() * ANSWERS.length);
  } while (i === lastIndex && ANSWERS.length > 1);
  lastIndex = i;
  return ANSWERS[i];
}
