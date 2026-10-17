/**
 * Universal Natural Schedule Parser (Bahasa Indonesia).
 * Mengekstrak tipe tugas, waktu, pesan pengingat, parameter cron,
 * serta jadwal shift kerja staf HRIS dari percakapan bahasa alami bebas.
 */

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Mendapatkan komponen waktu saat ini di zona Asia/Jakarta (WIB)
 */
function getCurrentWibComponents() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour, minute };
}

/**
 * Mendapatkan tanggal YYYY-MM-DD hari ini atau esok di Asia/Jakarta
 */
function getWibDateString(dayOffset = 0) {
  const date = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

/**
 * Ekstrak pesan tindakan dari kalimat pengingat
 */
function extractReminderTask(raw) {
  let text = raw.toLowerCase().trim();

  const remindIdx = text.search(/ingatkan\s+(?:saya|aku|kami|kita)?/i);
  if (remindIdx !== -1) {
    const after = text.slice(remindIdx).replace(/^ingatkan\s+(?:saya|aku|kami|kita)?\s*/i, '');

    // Pola A: untuk / agar / buat / supaya [tugas]
    const purposeMatch = after.match(/(?:untuk|agar|supaya|buat)\s+([^.!?]+)/i);
    if (purposeMatch) {
      let t = purposeMatch[1]
        .replace(/(?:pada|di|tiap|setiap)?\s*(?:jam|pukul)\s+(?:\d{1,2}(?:[:.]\d{2})?|segini|sekarang)\s*(?:pagi|siang|sore|malam|subuh)?/gi, '')
        .replace(/\d+\s*(?:menit|jam)\s+lagi/gi, '')
        .replace(/(?:nanti|besok|hari ini)\s*(?:pagi|siang|sore|malam)?/gi, '')
        .replace(/\b(?:segini|sekarang|setengah\s+jam\s+lagi|sejam\s+lagi)\b/gi, '')
        .trim();
      if (t.length >= 2) return capitalizeFirst(t);
    }

    // Pola B: fallback dengan membersihkan token waktu dari kalimat setelah 'ingatkan'
    let cleaned = after
      .replace(/(?:pada|di|tiap|setiap)?\s*(?:jam|pukul)\s+(?:\d{1,2}(?:[:.]\d{2})?|segini|sekarang)\s*(?:pagi|siang|sore|malam|subuh)?/gi, '')
      .replace(/\d+\s*(?:menit|jam)\s+lagi/gi, '')
      .replace(/(?:nanti|besok|hari ini)\s*(?:pagi|siang|sore|malam)?/gi, '')
      .replace(/^(?:untuk|agar|supaya|buat)\s+/i, '')
      .replace(/\b(?:segini|sekarang|setengah\s+jam\s+lagi|sejam\s+lagi)\b/gi, '')
      .trim();
    if (cleaned.length >= 2) return capitalizeFirst(cleaned);
  }

  // Pola C: Pola umum jika tanpa kata 'ingatkan'
  const generalPurpose = text.match(/(?:untuk|agar|supaya|buat)\s+([^.!?]+)/i);
  if (generalPurpose) {
    let t = generalPurpose[1]
      .replace(/(?:pada|di|tiap|setiap)?\s*(?:jam|pukul)\s+\d{1,2}(?:[:.]\d{2})?\s*(?:pagi|siang|sore|malam|subuh)?/gi, '')
      .replace(/(?:nanti|besok|hari ini)\s*/gi, '')
      .trim();
    if (t.length >= 2) return capitalizeFirst(t);
  }

  return null;
}

/**
 * Deteksi dan ekstraksi jadwal shift kerja staf HRIS
 */
function parseStaffShiftSchedule(raw, originalText) {
  // Pola: "jadwalkan [staf] shift [pagi|siang|sore|malam]" atau "jadwalkan shift [pagi|...] untuk [staf]"
  const shiftPatternA = /(?:jadwalkan|atur\s+jadwal|masuk)\s+(?:staf|barista|kasir|kitchen)?\s*([a-zA-Z0-9_]+)\s+(?:ke\s+|untuk\s+)?shift\s+(pagi|siang|sore|malam)/i;
  const shiftPatternB = /(?:jadwalkan|atur\s+jadwal)\s+shift\s+(pagi|siang|sore|malam)\s+(?:untuk\s+|buat\s+)?([a-zA-Z0-9_]+)/i;

  let staffName = null;
  let shiftRaw = null;

  const matchA = raw.match(shiftPatternA);
  if (matchA) {
    staffName = capitalizeFirst(matchA[1]);
    shiftRaw = matchA[2].toUpperCase();
  } else {
    const matchB = raw.match(shiftPatternB);
    if (matchB) {
      shiftRaw = matchB[1].toUpperCase();
      staffName = capitalizeFirst(matchB[2]);
    }
  }

  if (!staffName || !shiftRaw) return null;

  // Standar jam shift Komazi
  let shiftName = 'PAGI';
  let startTime = '07:00';
  let endTime = '15:00';

  if (shiftRaw === 'SIANG') {
    shiftName = 'SIANG';
    startTime = '12:00';
    endTime = '20:00';
  } else if (shiftRaw === 'SORE' || shiftRaw === 'MALAM') {
    shiftName = shiftRaw === 'SORE' ? 'SORE' : 'MALAM';
    startTime = '15:00';
    endTime = '23:00';
  }

  // Deteksi tanggal
  const isTomorrow = /\bbesok\b/i.test(raw);
  const dateString = isTomorrow ? getWibDateString(1) : getWibDateString(0);
  const dayDesc = isTomorrow ? 'Besok' : 'Hari ini';

  return {
    jobCategory: 'STAFF_SHIFT',
    jobType: 'STAFF_SCHEDULE',
    staffName,
    shiftName,
    startTime,
    endTime,
    dateString,
    timeDescription: `${dayDesc} (${dateString}), Shift ${shiftName} [${startTime} - ${endTime} WIB]`,
    name: `Shift ${shiftName}: ${staffName}`,
    originalText,
  };
}

export function parseNaturalScheduleText(text, callerTelegramId = null) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.toLowerCase().trim();

  // 1. Prioritas Pemeriksaan: Apakah ini perintah shift kerja staf HRIS?
  if (/(?:shift|jadwal\s+kerja)/i.test(raw) && /(?:pagi|siang|sore|malam)/i.test(raw)) {
    const staffShift = parseStaffShiftSchedule(raw, text);
    if (staffShift) return staffShift;
  }

  // 2. Deteksi intensi penjadwalan umum atau pengingat operasional
  const intentRegex = /(?:buat\s+jadwal|tambah\s+jadwal|bikin\s+jadwal|jadwalkan|pasang\s+jadwal|jadwal\s+baru|ingatkan|pengingat|reminder|cronjob|monitoring|laporan|backup)/i;
  const actionRegex = /(?:buat|tambah|bikin|jadwalkan|atur|pasang|ingatkan|pengingat|setiap|tiap|jam|pukul|menit|nanti|besok|sejam|setengah\s+jam)/i;

  const hasIntent = intentRegex.test(raw) && actionRegex.test(raw);
  if (!hasIntent) return null;

  // 3. Deteksi apakah pengingat personal ("saya", "aku")
  const isPersonal = /(?:ingatkan\s+(?:saya|aku)|untuk\s+(?:saya|aku))/i.test(raw);

  // 4. Deteksi Job Type
  let jobType = 'REMINDER';
  let defaultName = 'Pengingat Operasional';
  let taskPayload = {};

  if (/laporan|omzet|penjualan|sales|closing|tutup buku/i.test(raw) && !/ingatkan/i.test(raw)) {
    jobType = 'REPORT';
    defaultName = 'Laporan Penjualan Otomatis';
    taskPayload = { period: 'today' };
  } else if (/backup|cadangkan|pencadangan|dump/i.test(raw)) {
    jobType = 'BACKUP';
    defaultName = 'Backup & Verifikasi Database';
  } else if (/monitoring|kesehatan|health|sentinel|cek sistem|latensi/i.test(raw)) {
    jobType = 'MONITORING';
    defaultName = 'Monitoring Kesehatan Sistem';
  } else if (/ai|asisten|analisis|briefing|evaluasi/i.test(raw) && !/ingatkan/i.test(raw)) {
    jobType = 'AI_TASK';
    defaultName = 'Analisis Performa AI';
  } else {
    jobType = 'REMINDER';
    const extractedTask = extractReminderTask(raw);
    if (extractedTask) {
      defaultName = `Pengingat: ${extractedTask}`;
      taskPayload = {
        title: defaultName,
        message: extractedTask,
        recipientTelegramId: isPersonal && callerTelegramId ? Number(callerTelegramId) : null,
      };
    } else {
      defaultName = 'Pengingat Operasional Staf';
      taskPayload = {
        title: defaultName,
        message: 'Pengingat operasional terjadwal dari Komazi POS.',
        recipientTelegramId: isPersonal && callerTelegramId ? Number(callerTelegramId) : null,
      };
    }
  }

  // 5. Deteksi Waktu & Pola Cron / Waktu Spesifik
  let scheduleType = 'cron';
  let scheduleExpression = '0 22 * * *'; // Default 22:00 WIB
  let timeDescription = 'Setiap hari jam 22:00 WIB';

  // Deteksi periode waktu (pagi, siang, sore, malam, subuh)
  let contextPeriod = null;
  if (/\bmalam\b/i.test(raw)) contextPeriod = 'malam';
  else if (/\bsore\b/i.test(raw)) contextPeriod = 'sore';
  else if (/\bsiang\b/i.test(raw)) contextPeriod = 'siang';
  else if (/\bsubuh\b/i.test(raw)) contextPeriod = 'subuh';
  else if (/\bpagi\b/i.test(raw)) contextPeriod = 'pagi';

  // A. Pola "setengah jam lagi"
  if (/setengah\s+jam\s+lagi/i.test(raw)) {
    const msOffset = 30 * 60 * 1000;
    const targetDate = new Date(Date.now() + msOffset);
    scheduleType = 'once';
    scheduleExpression = targetDate.toISOString();
    const targetWib = targetDate.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
    timeDescription = `30 menit lagi (sekitar ${targetWib} WIB)`;
  }
  // B. Pola "sejam lagi"
  else if (/\bsejam\s+lagi\b/i.test(raw)) {
    const msOffset = 60 * 60 * 1000;
    const targetDate = new Date(Date.now() + msOffset);
    scheduleType = 'once';
    scheduleExpression = targetDate.toISOString();
    const targetWib = targetDate.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
    timeDescription = `1 jam lagi (sekitar ${targetWib} WIB)`;
  }
  // C. Pola relatif: "X menit lagi" atau "X jam lagi"
  else if (/(\d+)\s*(menit|jam)\s+lagi/i.test(raw)) {
    const relMatch = raw.match(/(\d+)\s*(menit|jam)\s+lagi/i);
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const msOffset = unit === 'jam' ? amount * 60 * 60 * 1000 : amount * 60 * 1000;

    const targetDate = new Date(Date.now() + msOffset);
    scheduleType = 'once';
    scheduleExpression = targetDate.toISOString();

    const targetWibTime = targetDate.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
    timeDescription = `${amount} ${unit} lagi (sekitar ${targetWibTime} WIB)`;
  }
  // D. Pola "jam segini" atau "jam sekarang"
  else if (/(?:jam|pukul)\s+(?:segini|sekarang|ini)/i.test(raw)) {
    const { hour, minute } = getCurrentWibComponents();
    scheduleExpression = `${minute} ${hour} * * *`;
    const hourFormatted = String(hour).padStart(2, '0');
    const minFormatted = String(minute).padStart(2, '0');
    timeDescription = `Setiap hari jam ${hourFormatted}:${minFormatted} WIB (jam saat ini)`;
  }
  // E. Pola hari mingguan: "tiap senin", "setiap jumat"
  else if (/(?:tiap|setiap)\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu)/i.test(raw)) {
    const dayMatch = raw.match(/(?:tiap|setiap)\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu)/i);
    const dayName = dayMatch[1].toLowerCase();
    const dayMap = {
      minggu: 0,
      senin: 1,
      selasa: 2,
      rabu: 3,
      kamis: 4,
      jumat: 5,
      sabtu: 6,
    };
    const dayNum = dayMap[dayName] !== undefined ? dayMap[dayName] : 1;

    // Cek apakah ada jam tertentu
    let hour = 8;
    let minute = 0;
    const hourMatch = raw.match(/(?:jam|pukul)\s+(\d{1,2})(?:[:.](\d{2}))?/i);
    if (hourMatch) {
      hour = parseInt(hourMatch[1], 10);
      minute = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    }

    scheduleType = 'cron';
    scheduleExpression = `${minute} ${hour} * * ${dayNum}`;
    const hourFormatted = String(hour).padStart(2, '0');
    const minFormatted = String(minute).padStart(2, '0');
    timeDescription = `Setiap hari ${capitalizeFirst(dayName)} jam ${hourFormatted}:${minFormatted} WIB`;
  }
  // F. Pola jam spesifik harian: "jam 20:00", "pukul 08.30", "jam 8 malam", "besok jam 9 pagi"
  else if (/(?:jam|pukul)\s+(\d{1,2})(?:[:.](\d{2}))?/i.test(raw)) {
    const timeMatch = raw.match(/(?:jam|pukul)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam|subuh)?/i);
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = (timeMatch[3] ? timeMatch[3].toLowerCase() : null) || contextPeriod;

    if (period === 'malam') {
      if (hour === 12) hour = 0;
      else if (hour < 12) hour += 12;
    } else if (period === 'sore') {
      if (hour <= 6) hour += 12;
    } else if (period === 'siang') {
      if (hour <= 5 && hour < 12) hour += 12;
    } else if (period === 'subuh') {
      if (hour === 12) hour = 0;
      else if (hour > 12) hour = hour % 12;
    } else if (period === 'pagi') {
      if (hour === 12) hour = 0;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const hourFormatted = String(hour).padStart(2, '0');
      const minFormatted = String(minute).padStart(2, '0');

      if (/\bbesok\b/i.test(raw)) {
        scheduleType = 'once';
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const wibYear = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const isoString = new Date(`${wibYear}T${hourFormatted}:${minFormatted}:00+07:00`).toISOString();
        scheduleExpression = isoString;
        timeDescription = `Besok jam ${hourFormatted}:${minFormatted} WIB`;
      } else {
        scheduleType = 'cron';
        scheduleExpression = `${minute} ${hour} * * *`;
        timeDescription = `Setiap hari jam ${hourFormatted}:${minFormatted} WIB`;
      }
    }
  }
  // G. Pola "tiap X menit" atau "setiap X menit"
  else if (/(?:tiap|setiap)\s+(\d+)\s+menit/i.test(raw)) {
    const minMatch = raw.match(/(?:tiap|setiap)\s+(\d+)\s+menit/i);
    const min = parseInt(minMatch[1], 10);
    scheduleType = 'cron';
    scheduleExpression = `*/${min} * * * *`;
    timeDescription = `Setiap ${min} menit`;
  }
  // H. Pola "tiap jam" / "setiap jam"
  else if (/(?:tiap|setiap)\s+jam(?!\s*\d)/i.test(raw)) {
    scheduleType = 'cron';
    scheduleExpression = '0 * * * *';
    timeDescription = 'Setiap 1 jam sekali';
  }

  return {
    jobCategory: 'SCHEDULED_JOB',
    jobType,
    name: defaultName,
    scheduleType,
    scheduleExpression,
    timezone: 'Asia/Jakarta',
    targetRoles: ['OWNER', 'MANAGER'],
    payload: taskPayload,
    isPersonal,
    timeDescription,
    originalText: text,
  };
}
