import { Text, TextProps } from "react-native";

interface CustomTextProps extends TextProps {
  children: React.ReactNode;
}

const CText: React.FC<CustomTextProps> = ({ style, children, ...props }) => (
  <Text {...props} style={[{ fontFamily: "reg" }, style]}>
    {children}
  </Text>
);

export default CText;