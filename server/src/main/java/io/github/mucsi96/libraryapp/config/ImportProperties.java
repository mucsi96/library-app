package io.github.mucsi96.libraryapp.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param pollInterval        how often the worker looks for due jobs
 * @param minJobInterval      minimum spacing between jobs across the whole
 *                            cluster; a job costs at most two provider
 *                            calls, so this is what bounds outbound RPM
 * @param maxAttempts         attempts before a transient failure is given
 *                            up on and shown to the user
 * @param retryBaseDelay      first backoff step, doubled per attempt
 * @param retryMaxDelay       ceiling for the backoff
 * @param staleAfter          how long a job may sit in a processing state
 *                            before it is assumed abandoned and requeued
 * @param completedVisibility how long a finished job stays in the client's
 *                            queue so the card can show its result
 * @param retention           how long finished jobs are kept before pruning
 * @param sweepInterval       how often stale and expired jobs are swept
 */
@ConfigurationProperties(prefix = "import")
public record ImportProperties(
    Duration pollInterval,
    Duration minJobInterval,
    int maxAttempts,
    Duration retryBaseDelay,
    Duration retryMaxDelay,
    Duration staleAfter,
    Duration completedVisibility,
    Duration retention,
    Duration sweepInterval) {
}
