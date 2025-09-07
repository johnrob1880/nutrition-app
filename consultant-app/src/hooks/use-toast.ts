import * as React from "react"

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

interface ToastState {
  toasts: ToastProps[]
}

interface ToastAction {
  type: "ADD_TOAST" | "REMOVE_TOAST"
  payload: ToastProps
}

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      }
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.payload.id),
      }
    default:
      return state
  }
}

let toastCount = 0

export function useToast() {
  const [state, dispatch] = React.useReducer(toastReducer, {
    toasts: [],
  })

  const toast = React.useCallback(
    ({ title, description, variant = "default" }: Omit<ToastProps, "id">) => {
      const id = `toast-${++toastCount}`
      
      dispatch({
        type: "ADD_TOAST",
        payload: {
          id,
          title,
          description,
          variant,
        },
      })

      // Auto remove toast after 5 seconds
      setTimeout(() => {
        dispatch({
          type: "REMOVE_TOAST",
          payload: { id } as ToastProps,
        })
      }, 5000)

      return id
    },
    []
  )

  const dismiss = React.useCallback((id: string) => {
    dispatch({
      type: "REMOVE_TOAST",
      payload: { id } as ToastProps,
    })
  }, [])

  return {
    toasts: state.toasts,
    toast,
    dismiss,
  }
}