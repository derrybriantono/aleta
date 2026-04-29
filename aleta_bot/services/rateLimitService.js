const logService = require("./logService");

const buckets = {
  minute: [],
  hour: [],
  day: [],
};

function prune(now) {
  buckets.minute = buckets.minute.filter((time) => now - time < 60 * 1000);
  buckets.hour = buckets.hour.filter((time) => now - time < 60 * 60 * 1000);
  buckets.day = buckets.day.filter((time) => now - time < 24 * 60 * 60 * 1000);
}

function getRateLimitConfig(runtimeConfig = {}) {
  const configured = runtimeConfig.rateLimit || {};
  return {
    maxPerMinute: Math.max(1, Number(configured.maxPerMinute || runtimeConfig.maxMessagesPerMinute || 60)),
    maxPerHour: Math.max(1, Number(configured.maxPerHour || runtimeConfig.maxMessagesPerHour || 1000)),
    maxPerDay: Math.max(1, Number(configured.maxPerDay || runtimeConfig.maxMessagesPerDay || 5000)),
  };
}

function checkRateLimit(runtimeConfig = {}) {
  const now = Date.now();
  prune(now);
  const config = getRateLimitConfig(runtimeConfig);

  if (buckets.minute.length >= config.maxPerMinute) {
    return { allowed: false, reason: "rate_limit_minute", config };
  }

  if (buckets.hour.length >= config.maxPerHour) {
    return { allowed: false, reason: "rate_limit_hour", config };
  }

  if (buckets.day.length >= config.maxPerDay) {
    return { allowed: false, reason: "rate_limit_day", config };
  }

  return { allowed: true, reason: "", config };
}

function recordSend() {
  const now = Date.now();
  prune(now);
  buckets.minute.push(now);
  buckets.hour.push(now);
  buckets.day.push(now);
}

function getRateLimitStats(runtimeConfig = {}) {
  const now = Date.now();
  prune(now);
  return {
    config: getRateLimitConfig(runtimeConfig),
    current: {
      minute: buckets.minute.length,
      hour: buckets.hour.length,
      day: buckets.day.length,
    },
  };
}

function logRateLimit(reason, metadata = {}) {
  logService.logSystemEvent({
    eventType: "rate_limit_reached",
    severity: "warning",
    message: `ALETA Bot rate limit reached: ${reason}`,
    metadata,
  });
}

module.exports = {
  checkRateLimit,
  recordSend,
  getRateLimitStats,
  logRateLimit,
};
