/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as React from 'react'
import { HTMLContainer, TLBounds, Utils, Vec, TLTransformInfo, Intersect } from '@tldraw/core'
import { getShapeStyle, getFontStyle, defaultStyle } from '~shape/shape-styles'
import {
  TextShape,
  TLDrawShapeUtil,
  TLDrawShapeType,
  TLDrawToolType,
  ArrowShape,
  TLDrawShapeProps,
} from '~types'
import styled from '~styles'
import TextAreaUtils from './text-utils'

const LETTER_SPACING = -1.5

function normalizeText(text: string) {
  return text.replace(/\r?\n|\r/g, '\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let melm: any

function getMeasurementDiv() {
  // A div used for measurement
  document.getElementById('__textMeasure')?.remove()

  const pre = document.createElement('pre')
  pre.id = '__textMeasure'

  Object.assign(pre.style, {
    whiteSpace: 'pre',
    width: 'auto',
    border: '1px solid red',
    padding: '4px',
    margin: '0px',
    letterSpacing: `${LETTER_SPACING}px`,
    opacity: '0',
    position: 'absolute',
    top: '-500px',
    left: '0px',
    zIndex: '9999',
    pointerEvents: 'none',
    userSelect: 'none',
    alignmentBaseline: 'mathematical',
    dominantBaseline: 'mathematical',
  })

  pre.tabIndex = -1

  document.body.appendChild(pre)
  return pre
}

if (typeof window !== 'undefined') {
  melm = getMeasurementDiv()
}

export class Text extends TLDrawShapeUtil<TextShape, HTMLDivElement> {
  type = TLDrawShapeType.Text as const
  toolType = TLDrawToolType.Text
  isAspectRatioLocked = true
  isEditableText = true
  canBind = true

  pathCache = new WeakMap<number[], string>([])

  defaultProps = {
    id: 'id',
    type: TLDrawShapeType.Text as const,
    name: 'Text',
    parentId: 'page',
    childIndex: 1,
    point: [0, 0],
    rotation: 0,
    text: ' ',
    style: defaultStyle,
  }

  create(props: Partial<TextShape>): TextShape {
    const shape = { ...this.defaultProps, ...props }
    const bounds = this.getBounds(shape)
    shape.point = Vec.sub(shape.point, [bounds.width / 2, bounds.height / 2])
    return shape
  }

  shouldRender(prev: TextShape, next: TextShape): boolean {
    return (
      next.text !== prev.text || next.style.scale !== prev.style.scale || next.style !== prev.style
    )
  }

  render = React.forwardRef<HTMLDivElement, TLDrawShapeProps<TextShape, HTMLDivElement>>(
    ({ shape, meta, isEditing, isBinding, onShapeChange, onShapeBlur, events }, ref) => {
      const rInput = React.useRef<HTMLTextAreaElement>(null)
      const { text, style } = shape
      const styles = getShapeStyle(style, meta.isDarkMode)
      const font = getFontStyle(shape.style)

      const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          onShapeChange?.({ ...shape, text: normalizeText(e.currentTarget.value) })
        },
        [shape]
      )

      const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === 'Escape') return

          e.stopPropagation()

          if (e.key === 'Tab') {
            e.preventDefault()
            if (e.shiftKey) {
              TextAreaUtils.unindent(e.currentTarget)
            } else {
              TextAreaUtils.indent(e.currentTarget)
            }

            onShapeChange?.({ ...shape, text: normalizeText(e.currentTarget.value) })
          }
        },
        [shape, onShapeChange]
      )

      const handleBlur = React.useCallback(
        (e: React.FocusEvent<HTMLTextAreaElement>) => {
          e.currentTarget.setSelectionRange(0, 0)
          onShapeBlur?.()
        },
        [isEditing, shape]
      )

      const handleFocus = React.useCallback(
        (e: React.FocusEvent<HTMLTextAreaElement>) => {
          if (!isEditing) return
          if (document.activeElement === e.currentTarget) {
            e.currentTarget.select()
          }
        },
        [isEditing]
      )

      const handlePointerDown = React.useCallback(
        (e) => {
          if (isEditing) {
            e.stopPropagation()
          }
        },
        [isEditing]
      )

      React.useEffect(() => {
        if (isEditing) {
          setTimeout(() => {
            const elm = rInput.current!
            elm.focus()
            elm.select()
          }, 0)
        } else {
          const elm = rInput.current!
          elm.setSelectionRange(0, 0)
        }
      }, [isEditing])

      return (
        <HTMLContainer ref={ref} {...events}>
          <StyledWrapper isEditing={isEditing} onPointerDown={handlePointerDown}>
            <StyledTextArea
              ref={rInput}
              style={{
                font,
                color: styles.stroke,
              }}
              name="text"
              defaultValue={text}
              tabIndex={-1}
              autoComplete="false"
              autoCapitalize="false"
              autoCorrect="false"
              autoSave="false"
              placeholder=""
              color={styles.stroke}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              autoFocus={isEditing}
              isEditing={isEditing}
              isBinding={isBinding}
              readOnly={!isEditing}
              wrap="off"
              dir="auto"
              datatype="wysiwyg"
            />
          </StyledWrapper>
        </HTMLContainer>
      )
    }
  )

  renderIndicator(): JSX.Element | null {
    return null
    // if (isEditing) return null

    // const { width, height } = this.getBounds(shape)

    // return <rect className="tl-selected" width={width} height={height} />
  }

  getBounds(shape: TextShape): TLBounds {
    const bounds = Utils.getFromCache(this.boundsCache, shape, () => {
      if (!melm) {
        // We're in SSR
        return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 }
      }

      melm.innerHTML = `${shape.text}&zwj;`
      melm.style.font = getFontStyle(shape.style)

      // In tests, offsetWidth and offsetHeight will be 0
      const width = melm.offsetWidth || 1
      const height = melm.offsetHeight || 1

      return {
        minX: 0,
        maxX: width,
        minY: 0,
        maxY: height,
        width,
        height,
      }
    })

    return Utils.translateBounds(bounds, shape.point)
  }

  getRotatedBounds(shape: TextShape): TLBounds {
    return Utils.getBoundsFromPoints(Utils.getRotatedCorners(this.getBounds(shape), shape.rotation))
  }

  getCenter(shape: TextShape): number[] {
    return Utils.getBoundsCenter(this.getBounds(shape))
  }

  hitTest(shape: TextShape, point: number[]): boolean {
    return Utils.pointInBounds(point, this.getBounds(shape))
  }

  hitTestBounds(shape: TextShape, bounds: TLBounds): boolean {
    const rotatedCorners = Utils.getRotatedCorners(this.getBounds(shape), shape.rotation)

    return (
      rotatedCorners.every((point) => Utils.pointInBounds(point, bounds)) ||
      Intersect.polyline.bounds(rotatedCorners, bounds).length > 0
    )
  }

  transform(
    _shape: TextShape,
    bounds: TLBounds,
    { initialShape, scaleX, scaleY }: TLTransformInfo<TextShape>
  ): Partial<TextShape> {
    const {
      rotation = 0,
      style: { scale = 1 },
    } = initialShape

    const nextScale = scale * Math.abs(Math.min(scaleX, scaleY))

    return {
      point: [bounds.minX, bounds.minY],
      rotation:
        (scaleX < 0 && scaleY >= 0) || (scaleY < 0 && scaleX >= 0) ? -(rotation || 0) : rotation,
      style: {
        ...initialShape.style,
        scale: nextScale,
      },
    }
  }

  transformSingle(
    _shape: TextShape,
    bounds: TLBounds,
    { initialShape, scaleX, scaleY }: TLTransformInfo<TextShape>
  ): Partial<TextShape> {
    const {
      style: { scale = 1 },
    } = initialShape

    return {
      point: Vec.round([bounds.minX, bounds.minY]),
      style: {
        ...initialShape.style,
        scale: scale * Math.max(Math.abs(scaleY), Math.abs(scaleX)),
      },
    }
  }

  onBoundsReset(shape: TextShape): Partial<TextShape> {
    const center = this.getCenter(shape)

    const newCenter = this.getCenter({
      ...shape,
      style: {
        ...shape.style,
        scale: 1,
      },
    })

    return {
      style: {
        ...shape.style,
        scale: 1,
      },
      point: Vec.round(Vec.add(shape.point, Vec.sub(center, newCenter))),
    }
  }

  onStyleChange(shape: TextShape): Partial<TextShape> {
    const center = this.getCenter(shape)

    this.boundsCache.delete(shape)

    const newCenter = this.getCenter(shape)

    return {
      point: Vec.round(Vec.add(shape.point, Vec.sub(center, newCenter))),
    }
  }

  shouldDelete(shape: TextShape): boolean {
    return shape.text.trim().length === 0
  }

  getBindingPoint(
    shape: TextShape,
    fromShape: ArrowShape,
    point: number[],
    origin: number[],
    direction: number[],
    padding: number,
    anywhere: boolean
  ) {
    const bounds = this.getBounds(shape)

    const expandedBounds = Utils.expandBounds(bounds, padding)

    let bindingPoint: number[]
    let distance: number

    // The point must be inside of the expanded bounding box
    if (!Utils.pointInBounds(point, expandedBounds)) return

    // The point is inside of the shape, so we'll assume the user is
    // indicating a specific point inside of the shape.
    if (anywhere) {
      if (Vec.dist(point, this.getCenter(shape)) < 12) {
        bindingPoint = [0.5, 0.5]
      } else {
        bindingPoint = Vec.divV(Vec.sub(point, [expandedBounds.minX, expandedBounds.minY]), [
          expandedBounds.width,
          expandedBounds.height,
        ])
      }

      distance = 0
    } else {
      // Find furthest intersection between ray from
      // origin through point and expanded bounds.

      // TODO: Make this a ray vs rounded rect intersection
      const intersection = Intersect.ray
        .bounds(origin, direction, expandedBounds)
        .filter((int) => int.didIntersect)
        .map((int) => int.points[0])
        .sort((a, b) => Vec.dist(b, origin) - Vec.dist(a, origin))[0]

      // The anchor is a point between the handle and the intersection
      const anchor = Vec.med(point, intersection)

      // If we're close to the center, snap to the center
      if (Vec.distanceToLineSegment(point, anchor, this.getCenter(shape)) < 12) {
        bindingPoint = [0.5, 0.5]
      } else {
        // Or else calculate a normalized point
        bindingPoint = Vec.divV(Vec.sub(anchor, [expandedBounds.minX, expandedBounds.minY]), [
          expandedBounds.width,
          expandedBounds.height,
        ])
      }

      if (Utils.pointInBounds(point, bounds)) {
        distance = 16
      } else {
        // If the binding point was close to the shape's center, snap to the center
        // Find the distance between the point and the real bounds of the shape
        distance = Math.max(
          16,
          Utils.getBoundsSides(bounds)
            .map((side) => Vec.distanceToLineSegment(side[1][0], side[1][1], point))
            .sort((a, b) => a - b)[0]
        )
      }
    }

    return {
      point: Vec.clampV(bindingPoint, 0, 1),
      distance,
    }
  }
}

const StyledWrapper = styled('div', {
  width: '100%',
  height: '100%',
  variants: {
    isEditing: {
      false: {
        pointerEvents: 'all',
      },
      true: {
        pointerEvents: 'none',
      },
    },
  },
})

const StyledTextArea = styled('textarea', {
  position: 'absolute',
  top: 'var(--tl-padding)',
  left: 'var(--tl-padding)',
  zIndex: 1,
  width: 'calc(100% - (var(--tl-padding) * 2))',
  height: 'calc(100% - (var(--tl-padding) * 2))',
  border: 'none',
  padding: '4px',
  whiteSpace: 'pre',
  alignmentBaseline: 'mathematical',
  dominantBaseline: 'mathematical',
  resize: 'none',
  minHeight: 1,
  minWidth: 1,
  lineHeight: 1.4,
  letterSpacing: LETTER_SPACING,
  outline: 0,
  fontWeight: '500',
  overflow: 'hidden',
  backfaceVisibility: 'hidden',
  display: 'inline-block',
  WebkitUserSelect: 'text',
  WebkitTouchCallout: 'none',
  variants: {
    isBinding: {
      false: {},
      true: {
        background: '$boundsBg',
      },
    },
    isEditing: {
      false: {
        pointerEvents: 'none',
        userSelect: 'none',
        background: 'none',
        WebkitUserSelect: 'none',
      },
      true: {
        pointerEvents: 'all',
        userSelect: 'text',
        background: '$boundsBg',
        WebkitUserSelect: 'text',
      },
    },
  },
})

const NormalText = styled('div', {
  display: 'block',
  whiteSpace: 'pre',
  alignmentBaseline: 'mathematical',
  dominantBaseline: 'mathematical',
  pointerEvents: 'none',
  opacity: '0.5',
  padding: '4px',
  margin: '0',
  outline: 0,
  fontWeight: '500',
  lineHeight: 1.4,
  letterSpacing: LETTER_SPACING,
})
