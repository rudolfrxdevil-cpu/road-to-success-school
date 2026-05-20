export interface SocialPost {
  id: string;
  author: string;
  content: string;
  likes: number;
  comments: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

const FIRST_NAMES = ["Leon", "Marie", "Lukas", "Emma", "Finn", "Mia", "Jonas", "Hannah", "Paul", "Sofia", "Noah", "Anna", "Elias", "Emilia", "Felix", "Lina", "Luis", "Mila", "Tim", "Lea"];

const SCHOOL_POST_TEMPLATES = [
  "Wenn der Lehrer sagt 'Die Klausur fällt heute aus' 😭🙌",
  "Diese eine Person, die 5 Minuten vor Abgabe noch nach dem Datum fragt...",
  "Lehrer: 'Ihr habt noch 5 Minuten.' Ich, der gerade Aufgabe 1 liest: 👁️👄👁️",
  "Niemand: Wirklich niemand: Der Lehrer, der die Hausaufgaben kontrolliert: 'Wo ist dein Heft?'",
  "Wenn du im Unterricht auf die Uhr guckst und denkst, dass schon 20 Minuten um sind, aber es waren nur 2.",
  "Ich, wie ich versuche, den Stoff von einem halben Jahr in einer Nacht zu lernen 🤡",
  "Lehrer: 'Gibt es noch Fragen?' Ich (innerlich): 'Ja, was wurde die letzten 45 Minuten gesagt?'",
  "Wenn jemand fragt, wie die Arbeit lief und du einfach nur lachst, um nicht zu weinen.",
  "Der Moment, wenn du aufgerufen wirst und die Antwort auf dem Tisch deines Nachbarn suchst.",
  "Ich, wie ich darauf warte, dass der Lehrer die Tafel abwischt, damit ich nicht mehr abschreiben muss.",
  "Wenn du versuchst, im Unterricht unauffällig zu essen 🍔🤐",
  "Gruppenarbeit: Einer macht die Arbeit, zwei gucken zu und einer weiß nicht mal, in welcher Gruppe er ist.",
  "Dieser Moment, wenn der Sitznachbar fehlt und man alleine gegen Langeweile kämpfen muss.",
  "Lehrer: 'Die Arbeit war eigentlich ganz einfach.' Der Notendurchschnitt: 4,5 📉",
  "Wenn der Feueralarm während einer Klausur losgeht 🙏🔥",
  "Mathe: Wenn du das richtige Ergebnis hast, aber dein Rechenweg anders aussieht.",
  "Lehrer: 'Das steht an der Tafel.' Die Schrift an der Tafel: 🪱〰️➰",
  "Ich, der vor der ganzen Klasse vorlesen muss und plötzlich das Lesen verlernt.",
  "Wenn du im Gang läufst und versuchst, Blickkontakt mit dem Lehrer zu vermeiden.",
  "Sportunterricht: Cooper-Test. Muss ich mehr sagen?",
  "Wenn der Stundenplan so ist, dass man jeden Tag bis 15 Uhr Schule hat 💀",
  "Lehrer: 'Wir haben heute viel vor.' Ich: 'Ich auch, schlafen.'",
  "Wenn du aufwachst, denkst es ist Samstag, aber dann merkst, dass es Dienstag ist.",
  "Diese eine Frage in der Klausur, die nichts mit dem Thema zu tun hat.",
  "Wenn du deine Noten siehst und überlegst, ob YouTuber noch ein cooler Job ist.",
  "Lehrer: 'Schreibt bitte leserlich.' Ich, während ich in Lichtgeschwindigkeit mitschreibe: 📝💨",
  "Wenn du dein Zeugnis vor deinen Eltern versteckst, bis sie gute Laune haben.",
  "Der Moment, wenn du kurz in Gedanken warst und auf einmal alle schreiben.",
  "Wenn du vergisst, Hausaufgaben zu machen und hoffst, dass der Lehrer es auch vergisst.",
  "Klassenfahrt: Die beste Zeit im Schuljahr! 🎉",
  "Wenn der Lehrer sagt: 'Das kommt sowieso in der Klausur dran.' 🚨",
  "Ich, wenn ich merke, dass ich den falschen Rucksack mit in die Schule genommen habe.",
  "Lehrer: 'Handys weg!' Ich: 'Welches Handy?' 📱👀",
  "Wenn der Vertretungsplan eine Freistunde ansagt! 🙌",
  "Der Kampf, morgens aus dem Bett zu kommen, um in die Schule zu gehen.",
  "Wenn du versuchst, dem Lehrer eine Antwort zu erklären, die du selbst nicht verstehst.",
  "Lehrer: 'Partnerarbeit!' Ich: *schaue sofort meinen besten Freund an* 👀",
  "Wenn du im Unterricht auf Toilette gehst, um Zeit zu schinden.",
  "Der Moment, wenn der Beamer nicht funktioniert und die halbe Stunde dafür draufgeht.",
  "Wenn du dich im Unterricht meldest und im selben Moment sofort merkst, dass die Antwort falsch ist.",
  "Schulgong: Das schönste Geräusch der Welt. 🔔",
  "Wenn der Lehrer fragt, wer an die Tafel möchte und alle auf den Boden gucken.",
  "Ich, wenn ich auf die Rückgabe einer wichtigen Klassenarbeit warte. 😰",
  "Wenn du auf dem Heimweg von der Schule bist und endlich entspannen kannst.",
  "Hausaufgaben über die Ferien sollten verboten werden. Wer stimmt zu?",
  "Wenn du bei Wikipedia kopierst und vergisst, die blauen Links zu entfernen.",
  "Wenn du dich in Geschichte meldest und aus Versehen das Römische Reich mit dem Zweiten Weltkrieg vertauschst.",
  "Lehrer: 'Nehmt eure Bücher raus.' Ich, der sein Buch im Spind gelassen hat: 😬",
  "Freistunde ist einfach die Belohnung für's Aufstehen.",
  "Wenn du merkst, dass du morgen eine Präsentation halten musst.",
  "Der Moment, wenn du in Musik vorsingen musst. 🎤",
  "Wenn der Schulbus genau dann wegfährt, wenn du ankommst. 🚌🏃",
  "Ich, während ich versuche, im Unterricht wach zu bleiben: 😴☕",
  "Wenn du die Lösung hast, dich aber nicht traust, sie zu sagen. Dann sagt es wer anders und es war richtig.",
  "Lehrer: 'Wer kann mir das erklären?' Stille."
];

export const SOCIAL_POSTS: SocialPost[] = [];
for (let i = 0; i < 500; i++) {
  const author = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] + (Math.floor(Math.random() * 90) + 10).toString();
  const template = SCHOOL_POST_TEMPLATES[Math.floor(Math.random() * SCHOOL_POST_TEMPLATES.length)];
  const likes = Math.floor(Math.random() * 5000) + 10;
  const comments = Math.floor(Math.random() * 300) + 1;
  const variation = i % 5 === 0 ? " 😂" : i % 3 === 0 ? " 💀" : i % 4 === 0 ? " Fr!!" : "";
  
  SOCIAL_POSTS.push({
    id: `post_${i}`,
    author: `@${author}`,
    content: template + variation,
    likes,
    comments
  });
}
