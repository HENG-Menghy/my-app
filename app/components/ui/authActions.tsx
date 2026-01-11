// @/components/ui/authActions.tsx

import ButtonOrLink from "../buttons/button";

const AuthActions = () => {
  return (
    <div className="flex items-center gap-[10px]">
      <ButtonOrLink
        name="Login"
        level="secondary"
        padding="px-[10px] py-2"
        href="/login"
        ariaLabel="Login"
        title="Go to login page"
      />
      <ButtonOrLink
        name="Sign up"
        level="primary"
        padding="px-[10px] py-2"
        href="/signup"
        ariaLabel="Sign up"
        title="Go to sign up page"
      />
    </div>
  );
};

export default AuthActions;
