import * as React from 'react'
import { connect } from 'react-redux'

import { loadTemplate } from '../actions'

const mapStateToProps = (state) => {
  return {
    idList: state.templates.idList
  }
}

const mapDispatchToProps = (dispatch) => ({
  handleClick: (e, id: string): void => {
    e.preventDefault()
    dispatch(loadTemplate(id))
  }
})

const LoadTemplate = ({idList, handleClick}) => {
  const options = idList.slice(1).map(id => {
    return <li key={id}><a onClick={(e) => handleClick(e, id)} href='#'>{id}</a></li>
  })
  return (
    <div className="dropdown">
      <button className="btn btn-primary dropdown-toggle"
              type="button" id="dropdownMenu1"
              data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
        <span className="glyphicon glyphicon-open"></span>
        Load
      </button>
      <ul className="dropdown-menu" aria-labelledby="dropdownMenu1">
        {options}
      </ul>
    </div>
  )
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LoadTemplate)
