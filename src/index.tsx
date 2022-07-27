import React, { useContext, useMemo } from "react";
import md5 from "blueimp-md5";
import { IExperiment } from "./misc/types";

const getExperimentGroup = (
  uuid: string,
  { name: experimentName, trafficPercentRange = 1, groups = [] }: IExperiment
) => {
  const [minPercent, maxPercent] = Array.isArray(trafficPercentRange)
    ? trafficPercentRange
    : [0, trafficPercentRange];

  /*
    │   Exp 1   │   Exp 2   │  Exp 3  │ Exp 4 │
    │  A  |  B  |           |         |       |
    0           10                           100
  */

  // [0, 0.1] equals 10% traffics
  // [0, 1] equals 100% traffics
  // [0.6, 1] and [0, 0.4] equals 40% traffics, but different people,
  // this need to some experiment with not intersection

  const currentId =
    Number(`0x${md5(experimentName, uuid).slice(0, 8)}`) / 0xffffffff;

  if (currentId < minPercent || currentId >= maxPercent) {
    return null;
  }

  const preparedId = (currentId - minPercent) / (maxPercent - minPercent);
  let groupWeight = 0;
  const totalWeight = groups.reduce(
    (accumulativeWeight, { weight }) => accumulativeWeight + weight,
    0
  );

  const currentGroup = groups.find((group) => {
    const currentWeight = group.weight / totalWeight;
    groupWeight += currentWeight;
    return preparedId < groupWeight;
  });

  return currentGroup || null;
};

interface ABTestContextProps {
  /**
   * user identifier, like uuid
   */
  userId?: string;
  /**
   * Dont changes experiments array
   */
  experiments?: IExperiment[];
}

const ABTestContext = React.createContext<ABTestContextProps>(
  {} as ABTestContextProps
);

interface ABTestProviderProps extends ABTestContextProps {
  children?: React.ReactNode;
}

const useVariant = (experimentName: string) => {
  const { experiments, userId } = useContext(ABTestContext);

  const variant = useMemo(() => {
    const currentExperiment =
      experiments &&
      userId &&
      experiments.find((experiment) => experiment.name === experimentName);
    const variantName = currentExperiment
      ? getExperimentGroup(userId, currentExperiment)
      : null;

    return variantName;
  }, [userId]);

  return variant;
};

const ABTestProvider = ({
  children,
  userId,
  experiments,
}: ABTestProviderProps) => {
  const value = useMemo(() => ({ userId, experiments }), [userId]);

  return (
    <ABTestContext.Provider value={value}>{children}</ABTestContext.Provider>
  );
};

interface ExperimentProps {
  name: string;
  children: React.ReactNode;
}

const Experiment = ({ name: experimentName, children }: ExperimentProps) => {
  const variantName = useVariant(experimentName);
  const variants = children ? React.Children.toArray(children) : [];
  const currentVariant =
    variantName &&
    variants.find((variant) => {
      if (React.isValidElement<VariantProps>(variant)) {
        return variant.props.name === variantName.name;
      }

      return false;
    });

  if (currentVariant) {
    return currentVariant;
  }

  const defaultVariant = variants.find((variant) => {
    if (React.isValidElement<VariantProps>(variant)) {
      return variant.props.default;
    }

    return false;
  });

  return defaultVariant || null;
};

interface VariantProps {
  name?: string;
  children?: React.ReactNode;
  default?: boolean;
}

const Variant = ({ children }: VariantProps) => children;

export {
  Variant,
  VariantProps,
  Experiment,
  ExperimentProps,
  ABTestProvider,
  ABTestProviderProps,
  useVariant,
  ABTestContextProps,
};
