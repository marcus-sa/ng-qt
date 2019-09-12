import * as ts from 'typescript';
import {
  Identifier,
  Node,
  PropertyAssignment,
  SourceFile,
  TransformationContext,
  Transformer,
  Visitor,
} from 'typescript';

/** Angular component decorator TemplateUrl property name */
const TEMPLATE_URL = 'templateUrl';
/** Angular component decorator StyleUrls property name */
const STYLE_URLS = 'styleUrls';
/** Angular component decorator Template property name */
const TEMPLATE = 'template';
/** Angular component decorator Styles property name */
const STYLES = 'styles';

const REQUIRE = 'require';
const EXPORT_DEFAULT = 'default';

/**
 * @internal
 */
export const name = 'inline-assets-transformer';
// increment this each time the code is modified
/**
 * @internal
 */
export const version = 1;

/**
 * Property names anywhere in an angular project to transform
 */
const TRANSFORM_PROPS = [TEMPLATE_URL, STYLE_URLS];

export function inlineAssetsTransformer() {
  /**
   * Traverses the AST down to the relevant assignments anywhere in the file
   * and returns a boolean indicating if it should be transformed.
   */
  function isPropertyAssignmentToTransform(
    node: Node,
  ): node is PropertyAssignment {
    return (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      TRANSFORM_PROPS.includes(node.name.text)
    );
  }

  /**
   * Clones the assignment and manipulates it depending on its name.
   */
  function transformPropertyAssignmentForJest(node: PropertyAssignment) {
    const mutableAssignment = ts.getMutableClone(node);

    function createDefaultRequireCall(literal: ts.StringLiteral) {
      return ts.createPropertyAccess(
        ts.createCall(ts.createIdentifier(REQUIRE), undefined, [literal]),
        EXPORT_DEFAULT,
      );
    }

    const assignmentNameText = (mutableAssignment.name as Identifier).text;
    const pathLiteral = mutableAssignment.initializer;
    switch (assignmentNameText) {
      case TEMPLATE_URL:
        if (ts.isStringLiteral(pathLiteral)) {
          mutableAssignment.name = ts.createIdentifier(TEMPLATE);
          mutableAssignment.initializer = createDefaultRequireCall(pathLiteral);
        }
        break;

      case STYLE_URLS:
        if (ts.isArrayLiteralExpression(pathLiteral)) {
          mutableAssignment.name = ts.createIdentifier(STYLES);
          mutableAssignment.initializer = ts.createArrayLiteral(
            pathLiteral.elements.reduce(
              (literals, literal) => {
                if (ts.isStringLiteral(literal)) {
                  const styleRequire = createDefaultRequireCall(literal);
                  return [...literals, styleRequire];
                }

                return literals;
              },
              [] as ts.Expression[],
            ),
          );
        }
        break;
    }

    return mutableAssignment;
  }

  function createVisitor(ctx: TransformationContext) {
    /**
     * Our main visitor, which will be called recursively for each node in the source file's AST
     * @param node The node to be visited
     */
    const visitor: Visitor = node => {
      let resultNode = node;

      // before we create a deep clone to modify, we make sure that
      // this is an assignment which we want to transform
      if (isPropertyAssignmentToTransform(node)) {
        // get transformed node with changed properties
        resultNode = transformPropertyAssignmentForJest(node);
      }

      // look for interesting assignments inside this node in any case
      resultNode = ts.visitEachChild(resultNode, visitor, ctx);

      // finally return the currently visited node
      return resultNode;
    };
    return visitor;
  }

  return (ctx: TransformationContext): Transformer<SourceFile> => (
    sf: SourceFile,
  ) => ts.visitNode(sf, createVisitor(ctx));
}

export const factory = inlineAssetsTransformer;