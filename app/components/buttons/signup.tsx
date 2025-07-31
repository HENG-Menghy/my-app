// @/components/buttons/signup.tsx

import Button from "./button";

const Signup = () => {
  return (
    <Button
      name="Sign up"
      level="primary"
      padding="p-2"
      borderRadius="rounded-md"
      href="/signup"
      ariaLabel="Sign up"
      title="Go to sign up page"
    />
  );
};

export default Signup;
