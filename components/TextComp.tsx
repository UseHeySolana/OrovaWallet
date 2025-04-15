import { Text, TextProps } from "react-native";

interface CustomTextProps extends TextProps {
  children: React.ReactNode;
  textColor?: string;
}

const CText: React.FC<CustomTextProps> = ({ style, children, className, textColor, ...props }) => (
  <Text {...props} className={`${textColor ? textColor : "text-[1rem] text-dark dark:text-white"} ${className}`} style={[{ fontFamily: "reg" }, style]}>
    {children}
  </Text>
);

export default CText;