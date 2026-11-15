import { wedding } from '../data/wedding.js';

export function getCountdown(now = new Date()) {
  const current = Number(now);
  if (current >= Date.parse(wedding.dayAfter)) return { status: 'married' };
  if (current >= Date.parse(wedding.dayStart)) return { status: 'today' };
  const seconds = Math.max(0, Math.floor((Date.parse(wedding.start) - current) / 1000));
  return {
    status: 'countdown',
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}

const stamp = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = value => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

function foldLine(line) {
  const encoder = new TextEncoder();
  let result = '', length = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (length + size > 75) { result += '\r\n '; length = 1; }
    result += char;
    length += size;
  }
  return result;
}

// The two events on the card: the wedding at the temple and the reception at the groom's residence.
export const EVENTS = Object.freeze({
  wedding: {
    uid: 'athulraj-anupama-wedding-20261025@wedding-invitation',
    summary: `${wedding.groom} & ${wedding.bride}'s Wedding`,
    start: wedding.start,
    end: wedding.end,
    location: `${wedding.venue}, ${wedding.venuePlace}`,
    description: `${wedding.intro}, ${wedding.inviteLine} ${wedding.groom} & ${wedding.bride}.\nWedding time: ${wedding.time} (India Standard Time).`,
  },
  reception: {
    uid: 'athulraj-anupama-reception-20261101@wedding-invitation',
    summary: `${wedding.groom} & ${wedding.bride}'s Wedding Reception`,
    start: wedding.reception.start,
    end: wedding.reception.end,
    location: `${wedding.reception.venue}, ${wedding.reception.place}`,
    description: `Wedding reception of ${wedding.groom} & ${wedding.bride}.\n${wedding.reception.time} (India Standard Time).`,
  },
});

const vevent = (event, now) => [
  'BEGIN:VEVENT',
  `UID:${event.uid}`,
  `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.start)}`, `DTEND:${stamp(event.end)}`,
  `SUMMARY:${escapeText(event.summary)}`,
  `LOCATION:${escapeText(event.location)}`,
  `DESCRIPTION:${escapeText(event.description)}`,
  'STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT',
];

export function createCalendarEvent(now = new Date()) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Akhil and Anupama//Wedding Invitation//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...vevent(EVENTS.wedding, now),
    ...vevent(EVENTS.reception, now),
    'END:VCALENDAR', '',
  ].map(foldLine).join('\r\n');
}

export function getGoogleCalendarUrl(which = 'wedding') {
  const event = EVENTS[which] || EVENTS.wedding;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${stamp(event.start)}/${stamp(event.end)}`,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function getMapsUrl() {
  return wedding.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${wedding.venue}, ${wedding.venuePlace}`)}`;
}



