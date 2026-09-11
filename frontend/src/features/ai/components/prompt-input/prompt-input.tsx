import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { cn } from "@/shared/utils/cn";
import type { FileUIPart, SourceDocumentUIPart } from "ai";
import { nanoid } from "nanoid";
import {
  type ChangeEventHandler,
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { usePromptInputDropTarget } from "../../hooks/use-prompt-input-drop-target";
import { convertFilePartsForSubmit } from "../../utils/prompt-input-files";
import { usePromptInputFiles } from "./use-prompt-input-files";
import {
  type AttachmentsContext,
  type ReferencedSourcesContext,
  LocalAttachmentsContext,
  LocalReferencedSourcesContext,
  useOptionalPromptInputController,
} from "./prompt-input-context";


export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit" | "onError"> & {
  accept?: string;
  multiple?: boolean;
  globalDrop?: boolean;
  syncHiddenInput?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  onError?: (err: { code: "max_files" | "max_file_size" | "accept"; message: string }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
};

export function PromptInputFormShell({
  accept,
  multiple,
  className,
  inputRef,
  formRef,
  handleChange,
  handleSubmit,
  children,
  formProps,
}: {
  accept?: string;
  multiple?: boolean;
  className?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  formRef: RefObject<HTMLFormElement | null>;
  handleChange: ChangeEventHandler<HTMLInputElement>;
  handleSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  formProps: HTMLAttributes<HTMLFormElement>;
}) {
  const { t } = useTranslation("ai");

  return (
    <>
      <input
        accept={accept}
        aria-label={t("promptInput.uploadFiles")}
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title={t("promptInput.uploadFiles")}
        type="file"
      />
      <form
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...formProps}
      >
        <InputGroup className="overflow-hidden">{children}</InputGroup>
      </form>
    </>
  );
}

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const { files, add, remove, clearAttachments, openFileDialog } = usePromptInputFiles({
    accept,
    maxFiles,
    maxFileSize,
    onError,
    controller,
    usingProvider,
    inputRef,
  });

  const [referencedSources, setReferencedSources] = useState<
    (SourceDocumentUIPart & { id: string })[]
  >([]);

  const clearReferencedSources = useCallback(() => setReferencedSources([]), []);

  const clear = useCallback(() => {
    clearAttachments();
    clearReferencedSources();
  }, [clearAttachments, clearReferencedSources]);

  useEffect(() => {
    if (!usingProvider) return;
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = "";
    }
  }, [files, syncHiddenInput]);

  usePromptInputDropTarget(formRef, globalDrop, add);

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        add(event.currentTarget.files);
      }
      event.currentTarget.value = "";
    },
    [add],
  );

  const attachmentsCtx = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear: clearAttachments,
      fileInputRef: inputRef,
      files: files.map((item) => ({ ...item, id: item.id })),
      openFileDialog,
      remove,
    }),
    [files, add, remove, clearAttachments, openFileDialog],
  );

  const refsCtx = useMemo<ReferencedSourcesContext>(
    () => ({
      add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => {
        const array = Array.isArray(incoming) ? incoming : [incoming];
        setReferencedSources((prev) => [...prev, ...array.map((s) => ({ ...s, id: nanoid() }))]);
      },
      clear: clearReferencedSources,
      remove: (id: string) => {
        setReferencedSources((prev) => prev.filter((s) => s.id !== id));
      },
      sources: referencedSources,
    }),
    [referencedSources, clearReferencedSources],
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const text = usingProvider
        ? controller.textInput.value
        : (() => {
            const formData = new FormData(form);
            return (formData.get("message") as string) || "";
          })();

      if (!usingProvider) {
        form.reset();
      }

      try {
        const convertedFiles = await convertFilePartsForSubmit(files);

        const result = onSubmit({ files: convertedFiles, text }, event);

        if (result instanceof Promise) {
          try {
            await result;
            clear();
            if (usingProvider) {
              controller.textInput.clear();
            }
          } catch {
            // keep state on error
          }
        } else {
          clear();
          if (usingProvider) {
            controller.textInput.clear();
          }
        }
      } catch {
        // keep state on error
      }
    },
    [usingProvider, controller, files, onSubmit, clear],
  );

  const inner = (
    <PromptInputFormShell
      accept={accept}
      multiple={multiple}
      className={className}
      inputRef={inputRef}
      formRef={formRef}
      handleChange={handleChange}
      handleSubmit={handleSubmit}
      formProps={props}
    >
      {children}
    </PromptInputFormShell>
  );

  const withReferencedSources = (
    <LocalReferencedSourcesContext.Provider value={refsCtx}>
      {inner}
    </LocalReferencedSourcesContext.Provider>
  );

  return (
    <LocalAttachmentsContext.Provider value={attachmentsCtx}>
      {withReferencedSources}
    </LocalAttachmentsContext.Provider>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn("contents", className)} {...props} />
);

export type PromptInputHeaderProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputHeader = ({ className, ...props }: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props}
  />
);

export type PromptInputFooterProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props}
  />
);
