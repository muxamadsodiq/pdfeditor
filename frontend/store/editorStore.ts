import { create } from "zustand";

import type { PdfDocumentMetadata, PdfTextLayerResponse, PdfTextSpan } from "@/types/pdf";

export interface TextStyle {
  font: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export type ActiveTool = "select" | "edit_text" | "add_text" | "add_image" | "draw" | "highlight" | "signature" | "erase_area";
export type AddedObjectType = "text" | "image" | "drawing" | "highlight" | "signature" | "erase";
export type PdfPoint = [number, number];
export type PdfRect = [number, number, number, number];

export interface AddedObject {
  id: string;
  type: AddedObjectType;
  pageNumber: number;
  bbox: PdfRect;
  text?: string;
  imageData?: string;
  points?: PdfPoint[];
  style: TextStyle & { width: number };
  opacity: number;
}

export interface ObjectEditOperation {
  id: string;
  page_number: number;
  target_span_id: string;
  operation: "add_text" | "add_image" | "draw_path" | "highlight" | "add_signature" | "erase_area";
  old_text: string;
  new_text: string;
  text: string;
  bbox: PdfRect;
  style: TextStyle & { width: number };
  position: { x: number; y: number };
  image_data: string;
  points: PdfPoint[];
  opacity: number;
}

export interface TextEditOperation {
  id: string;
  page_number: number;
  target_span_id: string;
  operation: "replace_text" | "delete_text";
  old_text: string;
  new_text: string;
  bbox: [number, number, number, number];
  style: TextStyle;
  position: {
    x: number;
    y: number;
  };
}

export type PageOperation =
  | { operation: "rotate_page"; page_number: number; degrees: number }
  | { operation: "rotate_all"; degrees: number }
  | { operation: "delete_pages"; page_numbers: number[] }
  | { operation: "reorder_pages"; page_order: number[] }
  | { operation: "duplicate_page"; page_number: number };

interface EditorSnapshot {
  textOverrides: Record<string, string>;
  styleOverrides: Record<string, TextStyle>;
  spanBboxOverrides: Record<string, PdfRect>;
  deletedSpanIds: Record<string, boolean>;
  editOperations: TextEditOperation[];
  addedObjects: AddedObject[];
  selectedPageNumbers: number[];
  pageOrder: number[];
  pageRotations: Record<number, number>;
  pageOperations: PageOperation[];
  unsavedPageChanges: boolean;
  unsavedChanges: boolean;
}

export interface EditorState {
  document: PdfDocumentMetadata | null;
  zoom: number;
  activePage: number;
  isUploading: boolean;
  error: string | null;
  textLayer: PdfTextLayerResponse | null;
  editMode: boolean;
  activeTool: ActiveTool;
  selectedSpanId: string | null;
  selectedSpan: PdfTextSpan | null;
  selectedPageNumber: number | null;
  editingValue: string;
  editingStyle: TextStyle | null;
  textOverrides: Record<string, string>;
  styleOverrides: Record<string, TextStyle>;
  spanBboxOverrides: Record<string, PdfRect>;
  deletedSpanIds: Record<string, boolean>;
  editOperations: TextEditOperation[];
  addedObjects: AddedObject[];
  objectOperations: ObjectEditOperation[];
  selectedPageNumbers: number[];
  pageOrder: number[];
  pageRotations: Record<number, number>;
  pageOperations: PageOperation[];
  unsavedPageChanges: boolean;
  selectedObjectId: string | null;
  pendingImageData: string | null;
  pendingImageType: "image" | "signature" | null;
  drawingStyle: { color: string; width: number };
  highlightStyle: { color: string; opacity: number };
  unsavedChanges: boolean;
  downloadUrl: string | null;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
  setDocument: (document: PdfDocumentMetadata | null) => void;
  setTextLayer: (textLayer: PdfTextLayerResponse | null) => void;
  setEditMode: (editMode: boolean) => void;
  setActiveTool: (tool: ActiveTool) => void;
  selectSpan: (span: PdfTextSpan, pageNumber: number) => void;
  setSelectedSpan: (span: PdfTextSpan | null) => void;
  updateEditingValue: (value: string) => void;
  updateSelectedStyle: (style: Partial<TextStyle>) => void;
  moveSelectedSpan: (bbox: PdfRect) => void;
  applySelectedEdit: () => void;
  cancelSelectedEdit: () => void;
  deleteSelectedSpan: () => void;
  addObject: (object: Omit<AddedObject, "id">) => string;
  selectObject: (id: string | null) => void;
  updateObject: (id: string, patch: Partial<AddedObject>, recordHistory?: boolean) => void;
  deleteSelectedObject: () => void;
  setPendingImage: (data: string, type: "image" | "signature") => void;
  clearPendingImage: () => void;
  setDrawingStyle: (style: Partial<{ color: string; width: number }>) => void;
  setHighlightStyle: (style: Partial<{ color: string; opacity: number }>) => void;
  togglePageSelection: (pageNumber: number) => void;
  clearPageSelection: () => void;
  rotateSelectedPages: (degrees: number) => void;
  rotateAllPages: (degrees: number) => void;
  deleteSelectedPages: () => void;
  duplicateSelectedPage: () => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  resetPageOperations: () => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  markEditsApplied: (downloadUrl: string) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitPage: () => void;
  setActivePage: (page: number) => void;
  setUploading: (isUploading: boolean) => void;
  setError: (error: string | null) => void;
}

export function defaultTextStyle(span: PdfTextSpan): TextStyle {
  const fontName = span.font || "Helvetica";
  const normalized = fontName.toLowerCase();
  return {
    font: fontName,
    size: span.size || 12,
    color: span.color || "#000000",
    bold: normalized.includes("bold") || normalized.includes("black") || normalized.includes("semibold"),
    italic: normalized.includes("italic") || normalized.includes("oblique"),
    underline: false,
  };
}

function snapshot(state: EditorState): EditorSnapshot {
  return {
    textOverrides: { ...state.textOverrides },
    styleOverrides: { ...state.styleOverrides },
    spanBboxOverrides: Object.fromEntries(
      Object.entries(state.spanBboxOverrides).map(([id, bbox]) => [id, [...bbox] as PdfRect]),
    ),
    deletedSpanIds: { ...state.deletedSpanIds },
    editOperations: [...state.editOperations],
    addedObjects: state.addedObjects.map((object) => ({
      ...object,
      bbox: [...object.bbox],
      points: object.points?.map((point) => [...point] as PdfPoint),
      style: { ...object.style },
    })),
    selectedPageNumbers: [...state.selectedPageNumbers],
    pageOrder: [...state.pageOrder],
    pageRotations: { ...state.pageRotations },
    pageOperations: [...state.pageOperations],
    unsavedPageChanges: state.unsavedPageChanges,
    unsavedChanges: state.unsavedChanges,
  };
}

function objectOperation(object: AddedObject): ObjectEditOperation {
  const operation = {
    text: "add_text",
    image: "add_image",
    drawing: "draw_path",
    highlight: "highlight",
    signature: "add_signature",
    erase: "erase_area",
  }[object.type] as ObjectEditOperation["operation"];
  return {
    id: object.id,
    page_number: object.pageNumber,
    target_span_id: "",
    operation,
    old_text: "",
    new_text: object.text ?? "",
    text: object.text ?? "",
    bbox: object.bbox,
    style: object.style,
    position: { x: object.bbox[0], y: object.bbox[1] },
    image_data: object.imageData ?? "",
    points: object.points ?? [],
    opacity: object.opacity,
  };
}

function objectOperations(objects: AddedObject[]) {
  return objects.map(objectOperation);
}

function objectId(objects: AddedObject[]) {
  const highest = objects.reduce((max, object) => {
    const value = Number(object.id.replace("object_", ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `object_${String(highest + 1).padStart(3, "0")}`;
}

function effectiveText(state: EditorState, span: PdfTextSpan): string {
  return state.textOverrides[span.id] ?? span.text;
}

function effectiveStyle(state: EditorState, span: PdfTextSpan): TextStyle {
  return state.styleOverrides[span.id] ?? defaultTextStyle(span);
}

function operationId(operations: TextEditOperation[]) {
  const highest = operations.reduce((max, operation) => {
    const value = Number(operation.id.replace("edit_", ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `edit_${String(highest + 1).padStart(3, "0")}`;
}

function upsertOperation(
  operations: TextEditOperation[],
  operation: Omit<TextEditOperation, "id">,
): TextEditOperation[] {
  const existing = operations.find((item) => item.target_span_id === operation.target_span_id);
  const next = { ...operation, id: existing?.id ?? operationId(operations) };
  return [...operations.filter((item) => item.target_span_id !== operation.target_span_id), next];
}

const emptySelection = {
  selectedSpanId: null,
  selectedSpan: null,
  selectedPageNumber: null,
  editingValue: "",
  editingStyle: null,
};

function initialPageOrder(document: PdfDocumentMetadata | null) {
  return document?.pages.map((page) => page.page_number) ?? [];
}

function markPageOperation(state: EditorState, operation: PageOperation, patch: Partial<EditorState>) {
  return {
    ...patch,
    pageOperations: [...state.pageOperations, operation],
    unsavedPageChanges: true,
    unsavedChanges: true,
    undoStack: [...state.undoStack, snapshot(state)],
    redoStack: [],
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  document: null,
  zoom: 1,
  activePage: 1,
  isUploading: false,
  error: null,
  textLayer: null,
  editMode: false,
  activeTool: "select",
  ...emptySelection,
  textOverrides: {},
  styleOverrides: {},
  spanBboxOverrides: {},
  deletedSpanIds: {},
  editOperations: [],
  addedObjects: [],
  objectOperations: [],
  selectedPageNumbers: [],
  pageOrder: [],
  pageRotations: {},
  pageOperations: [],
  unsavedPageChanges: false,
  selectedObjectId: null,
  pendingImageData: null,
  pendingImageType: null,
  drawingStyle: { color: "#111827", width: 2 },
  highlightStyle: { color: "#fde047", opacity: 0.35 },
  unsavedChanges: false,
  downloadUrl: null,
  undoStack: [],
  redoStack: [],
  setDocument: (document) =>
    set({
      document,
      activePage: 1,
      zoom: 1,
      error: null,
      textLayer: null,
      editMode: false,
      activeTool: "select",
      ...emptySelection,
      textOverrides: {},
      styleOverrides: {},
      spanBboxOverrides: {},
      deletedSpanIds: {},
      editOperations: [],
      addedObjects: [],
      objectOperations: [],
      selectedPageNumbers: [],
      pageOrder: initialPageOrder(document),
      pageRotations: {},
      pageOperations: [],
      unsavedPageChanges: false,
      selectedObjectId: null,
      pendingImageData: null,
      pendingImageType: null,
      unsavedChanges: false,
      downloadUrl: null,
      undoStack: [],
      redoStack: [],
    }),
  setTextLayer: (textLayer) => set({ textLayer }),
  setEditMode: (editMode) =>
    set((state) => ({
      editMode,
      activeTool: editMode ? "edit_text" : "select",
      selectedObjectId: null,
      ...(editMode ? {} : emptySelection),
      editingValue: editMode ? state.editingValue : "",
      editingStyle: editMode ? state.editingStyle : null,
    })),
  setActiveTool: (activeTool) =>
    set((state) => ({
      activeTool,
      editMode: activeTool === "edit_text",
      selectedObjectId: null,
      pendingImageData: activeTool === "add_image" || activeTool === "signature" ? state.pendingImageData : null,
      pendingImageType: activeTool === "add_image" || activeTool === "signature" ? state.pendingImageType : null,
      ...(activeTool === "edit_text" ? {} : emptySelection),
    })),
  selectSpan: (span, pageNumber) =>
    set((state) => ({
      selectedSpanId: span.id,
      selectedSpan: span,
      selectedPageNumber: pageNumber,
      editingValue: effectiveText(state, span),
      editingStyle: effectiveStyle(state, span),
    })),
  setSelectedSpan: (selectedSpan) =>
    set((state) => ({
      selectedSpan,
      selectedSpanId: selectedSpan?.id ?? null,
      selectedPageNumber: selectedSpan ? state.selectedPageNumber : null,
      editingValue: selectedSpan ? effectiveText(state, selectedSpan) : "",
      editingStyle: selectedSpan ? effectiveStyle(state, selectedSpan) : null,
    })),
  updateEditingValue: (editingValue) =>
    set((state) => ({
      editingValue,
      unsavedChanges: Boolean(state.selectedSpan) || state.unsavedChanges,
    })),
  updateSelectedStyle: (style) =>
    set((state) => {
      if (!state.selectedSpan) return {};
      return {
        editingStyle: { ...(state.editingStyle ?? effectiveStyle(state, state.selectedSpan)), ...style },
      };
    }),
  moveSelectedSpan: (bbox) =>
    set((state) => {
      if (!state.selectedSpan) return {};
      return {
        spanBboxOverrides: { ...state.spanBboxOverrides, [state.selectedSpan.id]: [...bbox] as PdfRect },
        unsavedChanges: true,
      };
    }),
  applySelectedEdit: () =>
    set((state) => {
      if (!state.selectedSpan || !state.selectedPageNumber) return {};
      const span = state.selectedSpan;
      const nextText = state.editingValue;
      const nextStyle = state.editingStyle ?? effectiveStyle(state, span);
      const nextBbox = state.spanBboxOverrides[span.id] ?? span.bbox;
      const nextOperations = upsertOperation(state.editOperations, {
        page_number: state.selectedPageNumber,
        target_span_id: span.id,
        operation: "replace_text",
        old_text: span.text,
        new_text: nextText,
        bbox: span.bbox,
        style: nextStyle,
        position: { x: nextBbox[0], y: nextBbox[1] },
      });
      return {
        textOverrides: { ...state.textOverrides, [span.id]: nextText },
        styleOverrides: { ...state.styleOverrides, [span.id]: nextStyle },
        deletedSpanIds: { ...state.deletedSpanIds, [span.id]: false },
        editOperations: nextOperations,
        unsavedChanges: nextOperations.length > 0 || state.objectOperations.length > 0 || state.pageOperations.length > 0,
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
        ...emptySelection,
      };
    }),
  cancelSelectedEdit: () =>
    set((state) => {
      const nextBboxes = { ...state.spanBboxOverrides };
      if (state.selectedSpan && !state.editOperations.some((operation) => operation.target_span_id === state.selectedSpan?.id)) {
        delete nextBboxes[state.selectedSpan.id];
      }
      return {
        ...emptySelection,
        spanBboxOverrides: nextBboxes,
        unsavedChanges: state.editOperations.length > 0 || state.objectOperations.length > 0 || state.pageOperations.length > 0 || state.unsavedPageChanges,
      };
    }),
  deleteSelectedSpan: () =>
    set((state) => {
      if (!state.selectedSpan || !state.selectedPageNumber) return {};
      const span = state.selectedSpan;
      const nextStyle = state.editingStyle ?? effectiveStyle(state, span);
      const nextOperations = upsertOperation(state.editOperations, {
        page_number: state.selectedPageNumber,
        target_span_id: span.id,
        operation: "delete_text",
        old_text: span.text,
        new_text: "",
        bbox: span.bbox,
        style: nextStyle,
        position: { x: span.bbox[0], y: span.bbox[1] },
      });
      return {
        deletedSpanIds: { ...state.deletedSpanIds, [span.id]: true },
        textOverrides: { ...state.textOverrides, [span.id]: "" },
        styleOverrides: { ...state.styleOverrides, [span.id]: nextStyle },
        editOperations: nextOperations,
        unsavedChanges: nextOperations.length > 0,
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
        ...emptySelection,
      };
    }),
  addObject: (object) => {
    let createdId = "";
    set((state) => {
      createdId = objectId(state.addedObjects);
      const nextObjects = [...state.addedObjects, { ...object, id: createdId }];
      return {
        addedObjects: nextObjects,
        objectOperations: objectOperations(nextObjects),
        selectedObjectId: createdId,
        activeTool: "select",
        editMode: false,
        pendingImageData: null,
        pendingImageType: null,
        unsavedChanges: true,
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
        ...emptySelection,
      };
    });
    return createdId;
  },
  selectObject: (selectedObjectId) => set({ selectedObjectId, ...emptySelection }),
  updateObject: (id, patch, recordHistory = true) =>
    set((state) => {
      const nextObjects = state.addedObjects.map((object) =>
        object.id === id
          ? {
              ...object,
              ...patch,
              bbox: patch.bbox ? [...patch.bbox] as PdfRect : object.bbox,
              style: patch.style ? { ...object.style, ...patch.style } : object.style,
            }
          : object,
      );
      return {
        addedObjects: nextObjects,
        objectOperations: objectOperations(nextObjects),
        unsavedChanges: true,
        undoStack: recordHistory ? [...state.undoStack, snapshot(state)] : state.undoStack,
        redoStack: recordHistory ? [] : state.redoStack,
      };
    }),
  deleteSelectedObject: () =>
    set((state) => {
      if (!state.selectedObjectId) return {};
      const nextObjects = state.addedObjects.filter((object) => object.id !== state.selectedObjectId);
      return {
        addedObjects: nextObjects,
        objectOperations: objectOperations(nextObjects),
        selectedObjectId: null,
        unsavedChanges: state.editOperations.length > 0 || nextObjects.length > 0 || state.pageOperations.length > 0,
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
      };
    }),
  setPendingImage: (pendingImageData, pendingImageType) =>
    set({
      pendingImageData,
      pendingImageType,
      activeTool: pendingImageType === "signature" ? "signature" : "add_image",
      editMode: false,
      selectedObjectId: null,
      ...emptySelection,
    }),
  clearPendingImage: () => set({ pendingImageData: null, pendingImageType: null }),
  setDrawingStyle: (style) => set((state) => ({ drawingStyle: { ...state.drawingStyle, ...style } })),
  setHighlightStyle: (style) => set((state) => ({ highlightStyle: { ...state.highlightStyle, ...style } })),
  togglePageSelection: (pageNumber) =>
    set((state) => {
      const selected = state.selectedPageNumbers.includes(pageNumber);
      return {
        selectedPageNumbers: selected
          ? state.selectedPageNumbers.filter((item) => item !== pageNumber)
          : [...state.selectedPageNumbers, pageNumber],
      };
    }),
  clearPageSelection: () => set({ selectedPageNumbers: [] }),
  rotateSelectedPages: (degrees) =>
    set((state) => {
      if (state.selectedPageNumbers.length === 0) return {};
      const nextRotations = { ...state.pageRotations };
      state.selectedPageNumbers.forEach((pageNumber) => {
        nextRotations[pageNumber] = ((nextRotations[pageNumber] ?? 0) + degrees + 360) % 360;
      });
      const operations = state.selectedPageNumbers.map((page_number) => ({ operation: "rotate_page" as const, page_number, degrees }));
      return {
        pageRotations: nextRotations,
        pageOperations: [...state.pageOperations, ...operations],
        unsavedPageChanges: true,
        unsavedChanges: true,
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
      };
    }),
  rotateAllPages: (degrees) =>
    set((state) => {
      if (!state.document) return {};
      const nextRotations = { ...state.pageRotations };
      state.document.pages.forEach((page) => {
        nextRotations[page.page_number] = ((nextRotations[page.page_number] ?? 0) + degrees + 360) % 360;
      });
      return markPageOperation(state, { operation: "rotate_all", degrees }, { pageRotations: nextRotations });
    }),
  deleteSelectedPages: () =>
    set((state) => {
      if (state.selectedPageNumbers.length === 0) return {};
      const selected = new Set(state.selectedPageNumbers);
      const nextOrder = state.pageOrder.filter((pageNumber) => !selected.has(pageNumber));
      if (nextOrder.length === 0) {
        return { error: "At least one page must remain." };
      }
      return markPageOperation(
        state,
        { operation: "delete_pages", page_numbers: [...state.selectedPageNumbers] },
        {
          pageOrder: nextOrder,
          selectedPageNumbers: [],
          activePage: nextOrder[0] ?? 1,
        },
      );
    }),
  duplicateSelectedPage: () =>
    set((state) => {
      const pageNumber = state.selectedPageNumbers[0];
      if (!pageNumber) return {};
      const index = state.pageOrder.indexOf(pageNumber);
      const nextOrder = [...state.pageOrder];
      nextOrder.splice(index >= 0 ? index + 1 : nextOrder.length, 0, pageNumber);
      return markPageOperation(
        state,
        { operation: "duplicate_page", page_number: pageNumber },
        { pageOrder: nextOrder },
      );
    }),
  reorderPages: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.pageOrder.length || toIndex >= state.pageOrder.length) {
        return {};
      }
      const nextOrder = [...state.pageOrder];
      const [moved] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, moved);
      return markPageOperation(state, { operation: "reorder_pages", page_order: nextOrder }, { pageOrder: nextOrder });
    }),
  resetPageOperations: () =>
    set((state) => ({
      pageOrder: initialPageOrder(state.document),
      selectedPageNumbers: [],
      pageRotations: {},
      pageOperations: [],
      unsavedPageChanges: false,
      unsavedChanges: state.editOperations.length > 0 || state.objectOperations.length > 0,
      undoStack: [...state.undoStack, snapshot(state)],
      redoStack: [],
    })),
  undo: () =>
    set((state) => {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) return {};
      return {
        ...previous,
        objectOperations: objectOperations(previous.addedObjects),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, snapshot(state)],
        ...emptySelection,
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.redoStack[state.redoStack.length - 1];
      if (!next) return {};
      return {
        ...next,
        objectOperations: objectOperations(next.addedObjects),
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: state.redoStack.slice(0, -1),
        ...emptySelection,
      };
    }),
  clearSelection: () => set({ ...emptySelection, selectedObjectId: null }),
  markEditsApplied: (downloadUrl) => set({ downloadUrl, unsavedChanges: false, unsavedPageChanges: false, selectedObjectId: null, ...emptySelection }),
  setZoom: (zoom) => set({ zoom: Math.min(2.5, Math.max(0.5, Number(zoom.toFixed(2)))) }),
  zoomIn: () => set((state) => ({ zoom: Math.min(2.5, Number((state.zoom + 0.1).toFixed(2))) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(0.5, Number((state.zoom - 0.1).toFixed(2))) })),
  fitPage: () => set({ zoom: 1 }),
  setActivePage: (activePage) => set({ activePage }),
  setUploading: (isUploading) => set({ isUploading }),
  setError: (error) => set({ error }),
}));
