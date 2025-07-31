// @/components/buttons/login.tsx

import Button from "./button";

const Login = () => {
  return (
    <Button 
      name="Login"
      level="secondary"
      padding="p-2"
      borderRadius="rounded-md"
      href="/login"
      ariaLabel="Login"
      title="Go to login page"
    />
  );
};

export default Login;
