import { useState, type ComponentProps } from 'react'
import { AuthField } from './auth-field.js'
import { EyeIcon, EyeOffIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

type Props = Omit<ComponentProps<typeof AuthField>, 'secureTextEntry' | 'trailingAction'>

export function AuthPasswordField(props: Props) {
  const [visible, setVisible] = useState(false)
  const palette = useSoftPalette()
  return (
    <AuthField
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailingAction={{
        label: visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
        icon: visible ? <EyeOffIcon size={20} color={palette.ink} /> : <EyeIcon size={20} color={palette.ink} />,
        onPress: () => setVisible((current) => !current),
        testID: props.testID ? `${props.testID}-visibility` : undefined,
      }}
    />
  )
}
