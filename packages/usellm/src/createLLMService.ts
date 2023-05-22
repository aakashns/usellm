import OpenAIStream from "./OpenAIStream";
import {
  AUDIO_TRANSCRIPTIONS_API_URL,
  CHAT_COMPLETIONS_API_URL,
  OpenAIMessage,
  dataURLToBlob,
  fillPrompt,
  makeErrorResponse,
} from "./utils";

export interface CreateLLMServiceOptions {
  openaiApiKey?: string;
  fetcher?: typeof fetch;
  templates?: { [id: string]: LLMServiceTemplate };
  debug?: boolean;
  isAllowed?: (options: LLMServiceHandleOptions) => boolean | Promise<boolean>;
}

const defaultTemplate = {
  model: "gpt-3.5-turbo",
  max_tokens: 200,
  temperature: 0.8,
};

export interface LLMServiceTemplate {
  id: string;
  systemPrompt?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: number;
}

export interface LLMServiceChatOptions {
  $action?: string;
  messages?: OpenAIMessage[];
  stream?: boolean;
  template?: string;
  inputs?: object;
  user?: string;
}

export interface LLMServiceTranscribeOptions {
  $action?: string;
  audioUrl?: string;
  language?: string;
  prompt?: string;
}

export interface LLMServiceHandleOptions {
  body: object;
  request?: Request;
}

export interface LLMServiceHandleResponse {
  result: ReadableStream | string;
}

export class LLMService {
  templates: { [id: string]: LLMServiceTemplate };
  openaiApiKey: string;
  fetcher: typeof fetch;
  debug: boolean;
  isAllowed: (options: LLMServiceHandleOptions) => boolean | Promise<boolean>;

  constructor({
    openaiApiKey = "",
    fetcher = fetch,
    templates = {},
    debug = false,
    isAllowed = () => true,
  }: CreateLLMServiceOptions) {
    this.openaiApiKey = openaiApiKey;
    this.fetcher = fetcher;
    this.templates = templates;
    this.debug = debug;
    this.isAllowed = isAllowed;
  }

  registerTemplate(template: LLMServiceTemplate) {
    this.templates[template.id] = template;
  }

  prepareBody(body: LLMServiceChatOptions) {
    const template = {
      ...defaultTemplate,
      ...(this.templates[body.template || ""] || {}),
    };

    let filledMessages = [];

    if (template.systemPrompt) {
      filledMessages.push({
        role: "system",
        content: fillPrompt(template.systemPrompt, body.inputs),
      });
    }

    if (template.userPrompt) {
      filledMessages.push({
        role: "user",
        content: fillPrompt(template.userPrompt, body.inputs),
      });
    }

    if (body.messages) {
      filledMessages = [...filledMessages, ...body.messages];
    }

    if (filledMessages.length == 0) {
      throw makeErrorResponse(
        "Empty message list. Please provide at least one message!",
        400
      );
    }

    const preparedBody = {
      messages: filledMessages,
      stream: body.stream,
      user: body.user,
      model: template.model,
      temperature: template.temperature,
      top_p: template.top_p,
      n: template.n,
      max_tokens: template.max_tokens,
      presence_penalty: template.presence_penalty,
      frequency_penalty: template.frequency_penalty,
      logit_bias: template.logit_bias,
    };

    return preparedBody;
  }

  async handle({
    body = {},
    request,
  }: LLMServiceHandleOptions): Promise<LLMServiceHandleResponse> {
    if (!(await this.isAllowed({ body, request }))) {
      throw makeErrorResponse("Request not allowed", 405);
    }

    if (!this.openaiApiKey) {
      throw makeErrorResponse("OpenAI API key is required.", 400);
    }
    if (!("$action" in body)) {
      throw makeErrorResponse(
        "`handle` expects a key $action in the body",
        400
      );
    }
    const { $action, ...rest } = body;
    if ($action === "chat") {
      return this.chat(rest as LLMServiceChatOptions);
    } else if ($action === "transcribe") {
      return this.transcribe(rest as LLMServiceTranscribeOptions);
    } else {
      throw makeErrorResponse(`Action "${$action}" is not supported`, 400);
    }
  }

  async chat(body: LLMServiceChatOptions): Promise<LLMServiceHandleResponse> {
    const preparedBody = this.prepareBody(body);
    if (this.debug) {
      console.log("[LLMService] preparedBody", preparedBody);
    }

    if (preparedBody.stream) {
      const result = await OpenAIStream({
        body: preparedBody,
        openaiApiKey: this.openaiApiKey,
        fetcher: this.fetcher,
      });
      return { result };
    } else {
      const response = await this.fetcher(CHAT_COMPLETIONS_API_URL, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        method: "POST",
        body: JSON.stringify(preparedBody),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
      const result = await response.text();
      return { result };
    }
  }

  async transcribe(options: LLMServiceTranscribeOptions) {
    const { audioUrl, language, prompt } = options;

    if (!audioUrl) {
      throw makeErrorResponse("'audioUrl' is required", 400);
    }

    const audioBlob = dataURLToBlob(audioUrl);

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");
    formData.append("model", "whisper-1");
    if (language) {
      formData.append("language", language);
    }
    if (prompt) {
      formData.append("prompt", prompt);
    }

    const response = await this.fetcher(AUDIO_TRANSCRIPTIONS_API_URL, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
    const result = await response.text();
    return { result };
  }
}

export default function createLLMService({
  openaiApiKey = "",
  fetcher = fetch,
  templates = {},
  isAllowed = () => true,
  debug = false,
}: CreateLLMServiceOptions = {}) {
  return new LLMService({ openaiApiKey, fetcher, templates, isAllowed, debug });
}
