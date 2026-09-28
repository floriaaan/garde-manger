import { defineMutation } from '../shared/define-mutation.js'

export const useRequestPasswordResetMutation = defineMutation(
  (connector, email: string) => connector.requestPasswordReset(email),
)

export const useResetPasswordMutation = defineMutation(
  (connector, input: { token: string; password: string }) => connector.resetPassword(input.token, input.password),
)
