package io.github.mucsi96.libraryapp.config;

import org.springframework.ai.model.openai.autoconfigure.OpenAiCommonProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;

@Configuration
public class AIConfiguration {

  // Our OpenAI SDK client (image edits) is configured from the same
  // properties as Spring AI's (chat), so one set of connection settings -
  // key, base url, timeout and retry policy - drives both.
  @Bean
  OpenAIClient openAIClient(OpenAiCommonProperties connectionProperties) {
    var clientBuilder = OpenAIOkHttpClient.builder()
        .apiKey(connectionProperties.getApiKey())
        .timeout(connectionProperties.getTimeout())
        .maxRetries(connectionProperties.getMaxRetries());

    if (connectionProperties.getBaseUrl() != null && !connectionProperties.getBaseUrl().isEmpty()) {
      clientBuilder.baseUrl(connectionProperties.getBaseUrl());
    }

    return clientBuilder.build();
  }
}
